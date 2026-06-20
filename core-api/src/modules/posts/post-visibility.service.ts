import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SelectQueryBuilder, Repository } from 'typeorm';
import { PrivacyType } from 'src/common/enums/privacy.enum';
import { Post } from 'src/modules/posts/entities/post.entity';
import { RelationsService } from 'src/modules/users/relations/relations.service';

type VisibilityContext = {
  followingIds: string[];
  blockedUserIds: string[];
};

@Injectable()
export class PostVisibilityService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly relationsService: RelationsService,
  ) {}

  async getViewerContext(userId: string): Promise<VisibilityContext> {
    const [followingIds, blockedUserIds] = await Promise.all([
      this.relationsService.getFollowingIds(userId),
      this.relationsService.getAllBlockedUserIds(userId),
    ]);

    return { followingIds, blockedUserIds };
  }

  async assertCanViewPost(postId: string, userId: string): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user', 'shared_post', 'shared_post.user'],
    });

    if (!post) {
      throw new NotFoundException('Post is not available');
    }

    await this.assertCanViewLoadedPost(post, userId);
    return post;
  }

  async assertCanViewLoadedPost(post: any, userId: string): Promise<void> {
    const canView = await this.canViewLoadedPost(post, userId);
    if (!canView) {
      throw new NotFoundException('Post is not available');
    }
  }

  async canViewLoadedPost(
    post: any,
    userId: string,
    context?: VisibilityContext,
  ): Promise<boolean> {
    if (!post || !userId) return false;

    const visibilityContext = context || (await this.getViewerContext(userId));
    if (!this.canViewSinglePost(post, userId, visibilityContext)) {
      return false;
    }

    if (post.shared_post) {
      return this.canViewSinglePost(
        post.shared_post,
        userId,
        visibilityContext,
      );
    }

    return true;
  }

  async filterVisiblePosts(posts: any[], userId: string): Promise<any[]> {
    const context = await this.getViewerContext(userId);
    const checks = await Promise.all(
      posts.map((post) => this.canViewLoadedPost(post, userId, context)),
    );

    return posts.filter((_post, index) => checks[index]);
  }

  async applyVisibilityQuery(
    qb: SelectQueryBuilder<Post>,
    userId?: string,
    aliases: {
      post?: string;
      user?: string;
      sharedPost?: string;
      sharedPostUser?: string;
    } = {},
  ): Promise<void> {
    const postAlias = aliases.post || 'post';
    const userAlias = aliases.user || 'user';
    const sharedPostAlias = aliases.sharedPost || 'shared_post';
    const sharedPostUserAlias = aliases.sharedPostUser || 'shared_post_user';

    if (!userId) {
      qb.andWhere(`${userAlias}.privacy = :publicPrivacy`, {
        publicPrivacy: PrivacyType.PUBLIC,
      });
      qb.andWhere(`${postAlias}.privacy = :publicPostPrivacy`, {
        publicPostPrivacy: PrivacyType.PUBLIC,
      });
      qb.andWhere(
        `(${sharedPostAlias}.id IS NULL OR (${sharedPostUserAlias}.privacy = :publicSharedUserPrivacy AND ${sharedPostAlias}.privacy = :publicSharedPostPrivacy))`,
        {
          publicSharedUserPrivacy: PrivacyType.PUBLIC,
          publicSharedPostPrivacy: PrivacyType.PUBLIC,
        },
      );
      return;
    }

    const { followingIds, blockedUserIds } =
      await this.getViewerContext(userId);

    if (blockedUserIds.length > 0) {
      qb.andWhere(`${postAlias}.user_id NOT IN (:...blockedUserIds)`, {
        blockedUserIds,
      });
      qb.andWhere(
        `(${sharedPostAlias}.id IS NULL OR ${sharedPostAlias}.user_id NOT IN (:...blockedUserIds))`,
        { blockedUserIds },
      );
    }

    if (followingIds.length > 0) {
      qb.andWhere(
        `(${userAlias}.privacy = :publicAccountPrivacy OR ${postAlias}.user_id = :viewerId OR ${postAlias}.user_id IN (:...followingIds))`,
        {
          publicAccountPrivacy: PrivacyType.PUBLIC,
          viewerId: userId,
          followingIds,
        },
      );
      qb.andWhere(
        `(${postAlias}.privacy = :publicPostPrivacy OR ${postAlias}.user_id = :viewerId OR (${postAlias}.privacy = :followerPostPrivacy AND ${postAlias}.user_id IN (:...followingIds)))`,
        {
          publicPostPrivacy: PrivacyType.PUBLIC,
          followerPostPrivacy: PrivacyType.FOLLOWER,
          viewerId: userId,
          followingIds,
        },
      );
      qb.andWhere(
        `(${sharedPostAlias}.id IS NULL OR ${sharedPostUserAlias}.privacy = :publicSharedAccountPrivacy OR ${sharedPostAlias}.user_id = :viewerId OR ${sharedPostAlias}.user_id IN (:...followingIds))`,
        {
          publicSharedAccountPrivacy: PrivacyType.PUBLIC,
          viewerId: userId,
          followingIds,
        },
      );
      qb.andWhere(
        `(${sharedPostAlias}.id IS NULL OR ${sharedPostAlias}.privacy = :publicSharedPostPrivacy OR ${sharedPostAlias}.user_id = :viewerId OR (${sharedPostAlias}.privacy = :followerSharedPostPrivacy AND ${sharedPostAlias}.user_id IN (:...followingIds)))`,
        {
          publicSharedPostPrivacy: PrivacyType.PUBLIC,
          followerSharedPostPrivacy: PrivacyType.FOLLOWER,
          viewerId: userId,
          followingIds,
        },
      );
      return;
    }

    qb.andWhere(
      `(${userAlias}.privacy = :publicAccountPrivacy OR ${postAlias}.user_id = :viewerId)`,
      { publicAccountPrivacy: PrivacyType.PUBLIC, viewerId: userId },
    );
    qb.andWhere(
      `(${postAlias}.privacy = :publicPostPrivacy OR ${postAlias}.user_id = :viewerId)`,
      { publicPostPrivacy: PrivacyType.PUBLIC, viewerId: userId },
    );
    qb.andWhere(
      `(${sharedPostAlias}.id IS NULL OR ${sharedPostUserAlias}.privacy = :publicSharedAccountPrivacy OR ${sharedPostAlias}.user_id = :viewerId)`,
      { publicSharedAccountPrivacy: PrivacyType.PUBLIC, viewerId: userId },
    );
    qb.andWhere(
      `(${sharedPostAlias}.id IS NULL OR ${sharedPostAlias}.privacy = :publicSharedPostPrivacy OR ${sharedPostAlias}.user_id = :viewerId)`,
      { publicSharedPostPrivacy: PrivacyType.PUBLIC, viewerId: userId },
    );
  }

  private canViewSinglePost(
    post: any,
    userId: string,
    context: VisibilityContext,
  ): boolean {
    if (!post || !post.user_id) return false;
    if (context.blockedUserIds.includes(post.user_id)) return false;
    if (post.user_id === userId) return true;

    const isFollowingAuthor = context.followingIds.includes(post.user_id);
    if (post.user?.privacy === PrivacyType.PRIVATE && !isFollowingAuthor) {
      return false;
    }

    if (post.privacy === PrivacyType.PRIVATE) return false;
    if (post.privacy === PrivacyType.FOLLOWER && !isFollowingAuthor) {
      return false;
    }

    return true;
  }
}
