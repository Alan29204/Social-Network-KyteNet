import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FeedService } from 'src/feed/feed.service';
import { ConfigService } from '@nestjs/config';
import { PostsService } from 'src/modules/posts/posts.service';
import { NotificationService } from 'src/modules/notifications/notifications.service';
import axios from 'axios';

/**
 * Processes post creation jobs:
 * 1. Checks AI Moderation policies
 * 2. Fans out the post to all followers' feed caches (if allowed)
 * 3. Sends post content to ai-services FastAPI for semantic embedding in ChromaDB (if allowed)
 */
@Processor('create-posts')
export class MediasPostsProcessor extends WorkerHost {
  constructor(
    private readonly feedService: FeedService,
    private readonly configService: ConfigService,
    private readonly postsService: PostsService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<any> {
    try {
      const postId: string = job.data['post_id'];
      const authorId: string = job.data['author_id'];
      const createdAt: Date = new Date(job.data['created_at']);
      const content: string = job.data['content'] || '';

      console.log(`[Queue] Processing post ${postId} by ${authorId}`);

      const aiBaseUrl = this.configService.get<string>(
        'AI_SERVICE_URL',
        'http://localhost:8000',
      );
      const aiKey = this.configService.get<string>(
        'AI_SERVICE_KEY',
        'key_auth',
      );
      const aiHeaders = { key_auth: aiKey };

      // 1. AI Moderation Check
      try {
        console.log(`[Moderation] Checking policy for post ${postId}`);
        const response = await axios.post(
          `${aiBaseUrl}/posts/check-policy-for-post`,
          { id: postId },
          { headers: aiHeaders },
        );

        const moderationResult = response.data;

        if (moderationResult?.decision === 'block') {
          console.log(
            `[Moderation] Post ${postId} blocked! Reason: ${moderationResult.reason}`,
          );

          // Remove the post completely
          // Mocking an IUser object since PostsService.remove requires it for authorization
          await this.postsService.remove(postId, { id: authorId } as any);

          // Send notification to author
          await this.notificationService.notifySystemWarning(
            authorId,
            'Bài viết đã bị gỡ bỏ',
            'Bài viết của bạn đã bị hệ thống tự động gỡ bỏ do vi phạm tiêu chuẩn cộng đồng (chứa hình ảnh nhạy cảm hoặc bạo lực).',
          );

          return { success: false, reason: 'blocked_by_ai' };
        }
      } catch (moderationErr) {
        console.warn(
          `[Moderation Warning] AI Server is down or failed, skipping moderation for post ${postId}:`,
          (moderationErr as Error)?.message,
        );
        // Continue processing to allow post creation even if AI fails (fault tolerance)
      }

      // 2. Fan out the post to followers' feed caches
      await this.feedService.fanoutPost(postId, authorId, createdAt);
      console.log(`[FeedFanout] Completed fanout for post ${postId}`);

      // 3. Send to AI service for embedding (only if content exists)
      if (content.trim()) {
        try {
          await axios.post(
            `${aiBaseUrl}/posts/embed`,
            { post_id: postId, content: content },
            { headers: aiHeaders },
          );
          console.log(`[Embedding] Post ${postId} embedded successfully`);
        } catch (embeddingError) {
          // Non-critical: log but don't fail the job
          console.warn(
            `[Embedding] Failed to embed post ${postId}:`,
            (embeddingError as Error)?.message,
          );
        }
      }

      return { success: true, postId };
    } catch (error) {
      console.error('[Queue] Error processing job:', error);
      throw error;
    }
  }
}
