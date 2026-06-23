import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FeedService } from 'src/feed/feed.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { buildPostSearchableText } from 'src/common/utils/searchableText';

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
      const hashtags: string[] = Array.isArray(job.data['hashtags'])
        ? job.data['hashtags']
        : [];
      const searchableText: string =
        job.data['searchable_text'] ||
        buildPostSearchableText(content, hashtags);

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

      // 1. Fan out the post to followers' feed caches
      await this.feedService.fanoutPost(postId, authorId, createdAt);
      console.log(`[FeedFanout] Completed fanout for post ${postId}`);

      // 2. Send to AI service for embedding when content or hashtags exist
      if (searchableText.trim()) {
        try {
          await axios.post(
            `${aiBaseUrl}/posts/embed`,
            { post_id: postId, content: searchableText, hashtags },
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
