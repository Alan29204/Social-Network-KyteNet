import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FeedService } from 'src/feed/feed.service';

/**
 * Processes post creation jobs: fans out the new post to all followers'
 * feed caches (Redis sorted sets).
 */
@Processor('create-posts')
export class MediasPostsProcessor extends WorkerHost {
  constructor(private readonly feedService: FeedService) {
    super();
  }

  async process(job: Job<unknown>): Promise<any> {
    try {
      const postId: string = job.data['post_id'];
      const authorId: string = job.data['author_id'];
      const createdAt: Date = new Date(job.data['created_at']);

      console.log(`[Queue] Processing post ${postId} by ${authorId}`);

      // Fan out the post to followers' feed caches
      await this.feedService.fanoutPost(postId, authorId, createdAt);
      console.log(`[FeedFanout] Completed fanout for post ${postId}`);

      return { success: true, postId };
    } catch (error) {
      console.error('[Queue] Error processing job:', error);
      throw error;
    }
  }
}
