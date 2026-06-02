import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from 'src/infra/redis/redis.service';

@Processor('avatar-updates')
@Injectable()
export class AvatarProcessor extends WorkerHost {
  private readonly logger = new Logger(AvatarProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { user_id } = job.data;
    this.logger.log(`Processing avatar update for user: ${user_id}`);

    try {
      // Find all posts authored by the user or where the user commented
      const results = await this.dataSource.query(
        `
        SELECT id as post_id FROM post WHERE user_id = $1
        UNION
        SELECT post_id FROM comment WHERE user_id = $1
        `,
        [user_id],
      );

      let deletedCount = 0;
      for (const row of results) {
        if (row.post_id) {
          await this.redisService.del(`post:${row.post_id}`);
          deletedCount++;
        }
      }

      this.logger.log(
        `Successfully cleared cache for ${deletedCount} posts related to user: ${user_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing avatar update for user ${user_id}:`,
        error,
      );
      throw error;
    }
  }
}
