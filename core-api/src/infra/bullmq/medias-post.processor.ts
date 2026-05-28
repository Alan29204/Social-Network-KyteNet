import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FeedService } from 'src/feed/feed.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Processes post creation jobs:
 * 1. Fans out the post to all followers' feed caches
 * 2. Sends post content to ai-services FastAPI for semantic embedding in ChromaDB
 */
@Processor('create-posts')
export class MediasPostsProcessor extends WorkerHost {
  constructor(
    private readonly feedService: FeedService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<any> {
    try {
      const postId: string = job.data['post_id'];
      const authorId: string = job.data['author_id'];
      const createdAt: Date = new Date(job.data['created_at']);
      const content: string = job.data['content'] || '';

      console.log(`[FeedFanout] Processing post ${postId} by ${authorId}`);

      // 1. Fan out the post to followers' feed caches
      await this.feedService.fanoutPost(postId, authorId, createdAt);
      console.log(`[FeedFanout] Completed fanout for post ${postId}`);

      // 2. Send to AI service for embedding (only if content exists)
      if (content.trim()) {
        try {
          const aiBaseUrl = this.configService.get<string>(
            'AI_SERVICE_URL',
            'http://localhost:8000',
          );
          await axios.post(`${aiBaseUrl}/posts/embed`, {
            post_id: postId,
            content: content,
          });
          console.log(`[Embedding] Post ${postId} embedded successfully`);
        } catch (embeddingError) {
          // Non-critical: log but don't fail the job
          console.warn(`[Embedding] Failed to embed post ${postId}:`, embeddingError.message);
        }
      }

      return { success: true, postId };
    } catch (error) {
      console.error('[FeedFanout] Error processing job:', error);
      throw error;
    }
  }
}
