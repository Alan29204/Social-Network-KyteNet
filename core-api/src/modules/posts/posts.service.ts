import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { IUser } from 'src/modules/users/users.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Repository } from 'typeorm';
import { RedisService } from 'src/infra/redis/redis.service';
import { MediaService } from 'src/infra/media/media.service';
import { UpdatePostDto } from './dto/update-post.dto';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { FeedService } from 'src/feed/feed.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RelationsService } from 'src/modules/users/relations/relations.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private repository: Repository<Post>,
    private readonly redisService: RedisService,
    private readonly mediaService: MediaService,
    private readonly feedService: FeedService,
    private readonly configService: ConfigService,
    @InjectQueue('create-posts')
    private mediasPostsQueue: Queue,
    @Inject(forwardRef(() => RelationsService))
    private readonly relationsService: RelationsService,
  ) {}

  /** Base URL + headers cho các call nội bộ tới ai-services. */
  private get aiBaseUrl(): string {
    return this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
  }
  private get aiHeaders() {
    return {
      key_auth: this.configService.get<string>('AI_SERVICE_KEY', 'key_auth'),
    };
  }

  /** Xóa embedding của bài viết khỏi ChromaDB (best-effort, không chặn xóa bài). */
  private async deletePostEmbedding(postId: string): Promise<void> {
    try {
      await axios.delete(`${this.aiBaseUrl}/posts/embed/${postId}`, {
        headers: this.aiHeaders,
        timeout: 5000,
      });
    } catch (err) {
      console.warn(
        `[Embedding] Failed to delete embedding for post ${postId}:`,
        (err as Error)?.message,
      );
    }
  }

  /** Cập nhật/embed lại nội dung bài viết trong ChromaDB (best-effort). */
  private async upsertPostEmbedding(
    postId: string,
    content: string,
  ): Promise<void> {
    if (!content?.trim()) {
      // Nội dung trống -> xóa embedding cũ nếu có
      await this.deletePostEmbedding(postId);
      return;
    }
    try {
      await axios.post(
        `${this.aiBaseUrl}/posts/embed`,
        { post_id: postId, content },
        { headers: this.aiHeaders, timeout: 5000 },
      );
    } catch (err) {
      console.warn(
        `[Embedding] Failed to upsert embedding for post ${postId}:`,
        (err as Error)?.message,
      );
    }
  }

  async findPostByID(id: string, currentUser?: IUser): Promise<any> {
    try {
      const postCache = await this.redisService.get(`post:${id}`);

      let postData: any;
      if (postCache) {
        postData = JSON.parse(postCache as string);
      } else {
        const postDb = await this.repository.findOne({
          where: { id },
          relations: [
            'user',
            'reactions',
            'comments',
            'comments.user',
            'comments.reactions',
            'shared_post',
            'shared_post.user',
            'shared_post.reactions',
            'shared_post.comments',
          ],
          order: {
            comments: {
              created_at: 'ASC',
            },
          },
        });
        if (!postDb)
          throw new NotFoundException(`Post id: ${id} does not exist`);

        // Absolute Override: loại bỏ reaction/comment đã bị ẩn do chặn (is_hidden)
        postDb.reactions = (postDb.reactions || []).filter((r) => !r.is_hidden);
        postDb.comments = (postDb.comments || []).filter((c) => !c.is_hidden);
        postDb.comments.forEach((c) => {
          c.reactions = (c.reactions || []).filter((r) => !r.is_hidden);
        });
        if (postDb.shared_post) {
          postDb.shared_post.reactions = (
            postDb.shared_post.reactions || []
          ).filter((r) => !r.is_hidden);
          postDb.shared_post.comments = (
            postDb.shared_post.comments || []
          ).filter((c) => !c.is_hidden);
        }

        postData = {
          ...postDb,
          comments: postDb.comments?.map((comment) => ({
            ...comment,
            interactions: {
              likes:
                comment.reactions?.filter((r) => r.reaction === 'like')
                  .length || 0,
              recomments: 0,
              comments: 0,
            },
          })),
          interactions: {
            likes:
              postDb.reactions?.filter((r) => r.reaction === 'like').length ||
              0,
            comments: postDb.comments?.length || 0,
            reposts: await this.repository.count({
              where: { shared_post_id: id },
            }),
          },
        };

        await this.redisService.set(
          `post:${id}`,
          JSON.stringify(postData),
          300,
        );
      }

      // Calculate is_liked runtime (after cache retrieval)
      if (currentUser) {
        postData.interactions = postData.interactions || {};
        postData.interactions.is_liked =
          postData.reactions?.some(
            (r: any) => r.user_id === currentUser.id && r.reaction === 'like',
          ) || false;

        postData.interactions.is_reposted = !!(await this.repository.findOne({
          where: { user_id: currentUser.id, shared_post_id: id },
        }));

        postData.comments = (postData.comments || []).map((comment: any) => ({
          ...comment,
          interactions: {
            ...comment.interactions,
            likes:
              comment.reactions?.filter((r: any) => r.reaction === 'like')
                .length || 0,
            is_liked:
              comment.reactions?.some(
                (r: any) =>
                  r.user_id === currentUser.id && r.reaction === 'like',
              ) || false,
          },
        }));
      }

      return postData;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Error find post with id: ${id}`);
    }
  }

  /**
   * Create a new post with the given content, medias and privacy.
   *
   * @param user The user who creates the post
   * @param dto The create post dto
   * @param file The uploaded medias
   *
   * @throws BadRequestException If the content and medias are empty
   * @throws InternalServerErrorException If there is an error when creating the post
   *
   * @returns A message indicating that the post has been created successfully
   */
  async create(user: IUser, dto: CreatePostDto, file: Express.Multer.File[]) {
    // Check if content and medias are empty
    if (!dto.content && (!file || file.length === 0))
      throw new BadRequestException('Content and medias are required');

    try {
      // Upload files to SeaweedFS (S3)
      const medias = await this.mediaService.uploadFiles(
        file || [],
        `posts/${user.id}`,
      );

      // Create a new post
      const newPost = new Post();
      newPost.id = uuidv4();
      newPost.user_id = user.id;
      newPost.content = dto?.content;
      newPost.medias = medias;
      newPost.hashtags = dto.hashtags || [];
      newPost.tagged_users = dto.tagged_users || [];
      newPost.privacy = dto.privacy;
      newPost.created_at = new Date();

      await this.repository.save(newPost);

      // Add feed fanout job to queue (also triggers embedding in ai-services)
      this.mediasPostsQueue.add(
        'create-posts',
        {
          post_id: newPost.id,
          author_id: newPost.user_id,
          created_at: newPost.created_at.toISOString(),
          content: newPost.content || '',
        },
        {
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      return {
        message: 'Create post successfully',
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      throw new InternalServerErrorException('Error when create post');
    }
  }

  /**
   * Share/Repost an existing post.
   * Creates a new post that references the original via shared_post_id.
   */
  async sharePost(
    user: IUser,
    postId: string,
    content?: string,
    privacy?: string,
  ) {
    const originalPost = await this.findPostByID(postId);
    if (!originalPost) {
      throw new NotFoundException(`Post id: ${postId} does not exist`);
    }

    if (originalPost.user?.id === user.id) {
      throw new BadRequestException('You cannot repost your own post');
    }

    if (originalPost.user?.privacy === 'private') {
      throw new BadRequestException('You cannot repost a post from a private account');
    }

    try {
      // Prevent chained reposts: always link to the TRUE original post
      const actualOriginalPostId =
        originalPost.shared_post_id || originalPost.id;

      const existingRepost = await this.repository.findOne({
        where: { user_id: user.id, shared_post_id: actualOriginalPostId },
      });

      if (existingRepost) {
        await this.repository.remove(existingRepost);
        return {
          message: 'Un-reposted successfully',
          post_id: actualOriginalPostId,
          is_reposted: false,
        };
      }

      const sharedPost = new Post();
      sharedPost.id = uuidv4();
      sharedPost.user_id = user.id;
      sharedPost.content = content || '';
      sharedPost.medias = [];
      sharedPost.hashtags = [];
      sharedPost.tagged_users = [];
      sharedPost.shared_post_id = actualOriginalPostId; // Only store ID to avoid TypeORM relation mapping issues
      sharedPost.privacy = (privacy as any) || originalPost.privacy;
      sharedPost.created_at = new Date();

      await this.repository.save(sharedPost);

      // Fan out the shared post
      this.mediasPostsQueue.add(
        'create-posts',
        {
          post_id: sharedPost.id,
          author_id: sharedPost.user_id,
          created_at: sharedPost.created_at.toISOString(),
        },
        { removeOnComplete: true, removeOnFail: true },
      );

      return {
        message: 'Post shared successfully',
        post_id: sharedPost.id,
        is_reposted: true,
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Error when sharing post');
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    user_id?: string,
    is_repost?: boolean,
    media_type?: 'image' | 'video',
    currentUser?: IUser,
  ) {
    try {
      const qb = this.repository.createQueryBuilder('post')
        .leftJoinAndSelect('post.user', 'user')
        .leftJoinAndSelect('post.reactions', 'reactions')
        .leftJoinAndSelect('post.comments', 'comments')
        .leftJoinAndSelect('post.shared_post', 'shared_post')
        .leftJoinAndSelect('shared_post.user', 'shared_post_user')
        .leftJoinAndSelect('shared_post.reactions', 'shared_post_reactions')
        .leftJoinAndSelect('shared_post.comments', 'shared_post_comments')
        .orderBy('post.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (user_id) {
        qb.andWhere('post.user_id = :user_id', { user_id });
      }

      if (is_repost !== undefined) {
        if (is_repost) {
          qb.andWhere('post.shared_post_id IS NOT NULL');
        } else {
          qb.andWhere('post.shared_post_id IS NULL');
        }
      }

      if (media_type) {
        if (media_type === 'video') {
          qb.andWhere(`array_to_string(post.medias, ',') ILIKE ANY (ARRAY['%.mp4%', '%.mov%', '%.webm%'])`);
        } else if (media_type === 'image') {
          qb.andWhere(`array_to_string(post.medias, ',') ILIKE ANY (ARRAY['%.jpg%', '%.jpeg%', '%.png%', '%.webp%', '%.gif%'])`);
        }
      }

      if (currentUser) {
        const followingIds = await this.relationsService.getFollowingIds(currentUser.id);
        const blockedUserIds = await this.relationsService.getAllBlockedUserIds(currentUser.id);
        if (blockedUserIds.length > 0) {
          qb.andWhere('post.user_id NOT IN (:...blockedUserIds)', { blockedUserIds });
          qb.andWhere('(shared_post_user.id IS NULL OR shared_post_user.id NOT IN (:...blockedUserIds))', { blockedUserIds });
        }
        
        if (followingIds.length > 0) {
          qb.andWhere('(user.privacy = :pub OR post.user_id = :cid OR post.user_id IN (:...followingIds))', { pub: 'public', cid: currentUser.id, followingIds });
        } else {
          qb.andWhere('(user.privacy = :pub OR post.user_id = :cid)', { pub: 'public', cid: currentUser.id });
        }
      } else {
        qb.andWhere('user.privacy = :pub', { pub: 'public' });
      }

      const [posts, total] = await qb.getManyAndCount();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const postIds = posts.map((p) => p.id);
      const actualPostIds = [
        ...new Set(posts.map((p) => p.shared_post_id || p.id)),
      ];
      const repostCountsMap: Record<string, number> = {};
      const userRepostsMap: Record<string, boolean> = {};

      if (actualPostIds.length > 0) {
        const repostsQuery = await this.repository
          .createQueryBuilder('post')
          .select('post.shared_post_id', 'shared_post_id')
          .addSelect('COUNT(*)', 'count')
          .where('post.shared_post_id IN (:...actualPostIds)', {
            actualPostIds,
          })
          .groupBy('post.shared_post_id')
          .getRawMany();

        repostsQuery.forEach((r) => {
          repostCountsMap[r.shared_post_id] = parseInt(r.count, 10);
        });

        if (currentUser) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const { In } = require('typeorm');
          const userReposts = await this.repository.find({
            where: {
              user_id: currentUser.id,
              shared_post_id: In(actualPostIds),
            },
            select: ['shared_post_id'],
          });
          userReposts.forEach((r) => {
            if (r.shared_post_id) {
              userRepostsMap[r.shared_post_id] = true;
            }
          });
        }
      }

      const data = posts.map((post) => {
        // Absolute Override: bỏ qua reaction/comment bị ẩn do chặn
        const visibleReactions = (post.reactions || []).filter(
          (r) => !r.is_hidden,
        );
        const visibleComments = (post.comments || []).filter(
          (c) => !c.is_hidden,
        );
        return {
          ...post,
          interactions: {
            likes:
              visibleReactions.filter((r) => r.reaction === 'like').length || 0,
            comments: visibleComments.length || 0,
            reposts: repostCountsMap[post.shared_post_id || post.id] || 0,
            is_liked:
              visibleReactions.some(
                (r) => r.user_id === currentUser?.id && r.reaction === 'like',
              ) || false,
            is_reposted:
              userRepostsMap[post.shared_post_id || post.id] || false,
          },
        };
      });

      return {
        data,
        meta: {
          total,
          page,
          last_page: Math.ceil(total / limit),
        },
      };
    } catch {
      throw new InternalServerErrorException('Error when fetching posts');
    }
  }

  async findOne(user: IUser, id: string) {
    return this.findPostByID(id, user);
  }

  async update(user: IUser, dto: UpdatePostDto) {
    const post = await this.findPostByID(dto.id);
    if (post.user_id !== user.id) {
      throw new BadRequestException(
        'You are not authorized to update this post',
      );
    }

    try {
      await this.repository.update(dto.id, {
        content: dto.content,
        privacy: dto.privacy,
      });
      await this.redisService.del(`post:${dto.id}`);

      // Đồng bộ embedding khi nội dung thay đổi (best-effort)
      if (dto.content !== undefined) {
        await this.upsertPostEmbedding(dto.id, dto.content || '');
      }

      return { message: 'Update post successfully' };
    } catch {
      throw new InternalServerErrorException('Error when updating post');
    }
  }

  async remove(id: string, user: IUser) {
    try {
      const post = await this.findPostByID(id);

      if (post.user_id !== user.id) {
        throw new BadRequestException(
          'You are not authorized to delete this post',
        );
      }

      // Delete media files from SeaweedFS
      if (post.medias && post.medias.length > 0) {
        await this.mediaService.deleteFiles(post.medias);
      }

      // Fetch raw entity to remove to avoid TypeORM errors with mapped properties
      const postToRemove = await this.repository.findOne({ where: { id } });
      if (postToRemove) {
        // Delete dependent records manually to avoid foreign key constraint errors
        const deleteQueries = [
          { q: `DELETE FROM reaction WHERE post_id = $1`, params: [id] },
          { q: `DELETE FROM comment WHERE post_id = $1`, params: [id] },
          { q: `DELETE FROM save_post WHERE post_id = $1`, params: [id] },
          { q: `DELETE FROM report WHERE reported_post_id = $1`, params: [id] },
        ];

        for (const query of deleteQueries) {
          try {
            await this.repository.manager.query(query.q, query.params);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
            // Ignore if table/column does not exist
          }
        }
        // Set shared_post_id to NULL for any reposts of this post
        await this.repository.manager.query(
          `UPDATE post SET shared_post_id = NULL WHERE shared_post_id = $1`,
          [id],
        );

        await this.repository.remove(postToRemove);
      }
      await this.redisService.del(`post:${id}`);

      // Remove from all followers' feeds (async)
      await this.feedService.removePostFromFeeds(id, user.id);

      // Đồng bộ: xóa embedding khỏi ChromaDB (best-effort)
      await this.deletePostEmbedding(id);

      return { message: 'Delete post successfully' };
    } catch (err) {
      console.error('DELETE POST ERROR:', err);
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Error when deleting post');
    }
  }
}
