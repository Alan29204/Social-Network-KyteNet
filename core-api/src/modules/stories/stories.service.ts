import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { Story, StoryType } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { Relation } from 'src/modules/users/relations/entities/relation.entity';
import { RelationType } from 'src/common/enums/relation.enum';
import { MediaService } from 'src/infra/media/media.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { IUser } from 'src/modules/users/users.interface';

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryView)
    private readonly storyViewRepository: Repository<StoryView>,
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
    private readonly mediaService: MediaService,
  ) {}

  /** Tạo story mới (ảnh/video hoặc text). Tự động hết hạn sau 24h. */
  async create(
    user: IUser,
    dto: CreateStoryDto,
    file?: Express.Multer.File,
  ): Promise<Story> {
    let mediaUrl: string | null = null;
    let type = StoryType.TEXT;

    if (file) {
      mediaUrl = await this.mediaService.uploadFile(file, 'medias-stories');
      type = file.mimetype.startsWith('video/')
        ? StoryType.VIDEO
        : StoryType.IMAGE;
    } else if (!dto.content) {
      throw new BadRequestException(
        'Story phải có nội dung text hoặc media (ảnh/video)',
      );
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = this.storyRepository.create({
      user_id: user.id,
      type,
      media_url: mediaUrl,
      content: dto.content || null,
      background: dto.background || null,
      privacy: dto.privacy,
      expires_at: expiresAt,
    });

    return this.storyRepository.save(story);
  }

  /**
   * Lấy feed story: story của bản thân + những người đang follow,
   * còn hạn (expires_at > now), gom theo từng user.
   */
  async getFeed(user: IUser) {
    // Lấy danh sách người đang follow
    const following = await this.relationRepository.find({
      where: {
        request_side_id: user.id,
        relation_type: RelationType.FOLLOWING,
      },
      select: ['accept_side_id'],
    });
    const followingIds = following.map((r) => r.accept_side_id);

    const authorIds = [user.id, ...followingIds];

    const stories = await this.storyRepository.find({
      where: {
        user_id: In(authorIds),
        expires_at: MoreThan(new Date()),
      },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });

    // Story đã xem bởi current user
    const storyIds = stories.map((s) => s.id);
    const viewed =
      storyIds.length > 0
        ? await this.storyViewRepository.find({
            where: { story_id: In(storyIds), viewer_id: user.id },
            select: ['story_id'],
          })
        : [];
    const viewedSet = new Set(viewed.map((v) => v.story_id));

    // Gom theo user
    const groupedMap = new Map<string, any>();
    for (const story of stories) {
      const uid = story.user_id;
      if (!groupedMap.has(uid)) {
        groupedMap.set(uid, {
          user: {
            id: story.user?.id,
            username: story.user?.username,
            avatar: (story.user as any)?.avatar,
          },
          stories: [],
          has_unseen: false,
        });
      }
      const group = groupedMap.get(uid);
      const isViewed = viewedSet.has(story.id);
      group.stories.push({ ...story, is_viewed: isViewed });
      if (!isViewed) group.has_unseen = true;
    }

    // Đưa story của chính mình lên đầu, sau đó nhóm có story chưa xem
    const groups = Array.from(groupedMap.values());
    groups.sort((a, b) => {
      if (a.user.id === user.id) return -1;
      if (b.user.id === user.id) return 1;
      return (b.has_unseen ? 1 : 0) - (a.has_unseen ? 1 : 0);
    });

    return groups;
  }

  /** Lấy story của một user cụ thể (còn hạn). */
  async getUserStories(userId: string) {
    return this.storyRepository.find({
      where: { user_id: userId, expires_at: MoreThan(new Date()) },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });
  }

  /** Đánh dấu đã xem story. */
  async markViewed(storyId: string, user: IUser) {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('Story không tồn tại');

    // Bỏ qua nếu xem story của chính mình
    if (story.user_id === user.id) return { success: true };

    const existing = await this.storyViewRepository.findOne({
      where: { story_id: storyId, viewer_id: user.id },
    });
    if (!existing) {
      await this.storyViewRepository.save(
        this.storyViewRepository.create({
          story_id: storyId,
          viewer_id: user.id,
        }),
      );
    }
    return { success: true };
  }

  /** Lấy danh sách người đã xem story (chỉ chủ story). */
  async getViewers(storyId: string, user: IUser) {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('Story không tồn tại');
    if (story.user_id !== user.id) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách này');
    }

    const views = await this.storyViewRepository.find({
      where: { story_id: storyId },
      relations: ['viewer'],
      order: { created_at: 'DESC' },
    });

    return views.map((v) => ({
      id: v.viewer?.id,
      username: v.viewer?.username,
      avatar: (v.viewer as any)?.avatar,
      viewed_at: v.created_at,
    }));
  }

  /** Xóa story (chỉ chủ sở hữu). */
  async remove(storyId: string, user: IUser) {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('Story không tồn tại');
    if (story.user_id !== user.id) {
      throw new ForbiddenException('Bạn không có quyền xóa story này');
    }

    if (story.media_url) {
      await this.mediaService.deleteFile(story.media_url);
    }
    await this.storyRepository.delete(storyId);
    return { success: true, message: 'Đã xóa story' };
  }

  /** Dọn dẹp các story đã hết hạn (có thể gọi bằng cron). */
  async cleanupExpired() {
    const expired = await this.storyRepository.find({
      where: { expires_at: LessThan(new Date()) },
      select: ['id', 'media_url'],
    });
    if (expired.length === 0) return { removed: 0 };

    const urls = expired.map((s) => s.media_url).filter(Boolean);
    await this.mediaService.deleteFiles(urls);
    await this.storyRepository.delete(expired.map((s) => s.id));
    return { removed: expired.length };
  }
}
