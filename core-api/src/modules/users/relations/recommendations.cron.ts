import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Relation } from './entities/relation.entity';
import { RedisService } from '../../../infra/redis/redis.service';

@Injectable()
export class RecommendationsCron {
  private readonly logger = new Logger(RecommendationsCron.name);

  constructor(
    @InjectRepository(Relation)
    private readonly relationRepository: Repository<Relation>,
    private readonly redisService: RedisService,
  ) {}

  // Run at 2:00 AM every day
  @Cron('0 2 * * *')
  async calculateRecommendations() {
    this.logger.log('Starting daily friend recommendation calculation...');
    
    // In a real huge app, we only get active users. Here we get all users for simplicity.
    const users = await this.relationRepository.query(`SELECT id FROM "user"`);
    let count = 0;

    for (const user of users) {
      try {
        const query = `
          SELECT 
              u.id, u.username, u.full_name, u.avatar,
              CAST(COUNT(r2.request_side_id) AS INTEGER) as mutual_count,
              COALESCE(
                  json_agg(
                      json_build_object('id', mutual_user.id, 'username', mutual_user.username, 'avatar', mutual_user.avatar)
                  ) FILTER (WHERE mutual_user.id IS NOT NULL), 
                  '[]'
              ) as mutual_friends
          FROM "user" u
          INNER JOIN relation r2 ON r2.accept_side_id = u.id AND r2.relation_type = 'following' AND r2.is_restricted = false
          INNER JOIN relation r1 ON r1.accept_side_id = r2.request_side_id AND r1.request_side_id = $1 AND r1.relation_type = 'following' AND r1.is_restricted = false
          LEFT JOIN "user" mutual_user ON mutual_user.id = r2.request_side_id
          WHERE u.id != $1
          AND u.id NOT IN (
              SELECT accept_side_id FROM relation WHERE request_side_id = $1 AND relation_type IN ('following', 'block', 'pending')
          )
          AND u.id NOT IN (
              SELECT request_side_id FROM relation WHERE accept_side_id = $1 AND relation_type = 'block'
          )
          GROUP BY u.id
          ORDER BY mutual_count DESC, RANDOM()
          LIMIT 20
        `;

        const suggestedUsers = await this.relationRepository.query(query, [user.id]);
        
        // Save to Redis with 24h TTL
        await this.redisService.set(`suggested:${user.id}`, JSON.stringify(suggestedUsers), 86400);
        count++;
      } catch (e) {
        this.logger.error(`Error calculating recommendations for user ${user.id}:`, e);
      }
    }

    this.logger.log(`Finished calculating recommendations for ${count} users.`);
  }
}
