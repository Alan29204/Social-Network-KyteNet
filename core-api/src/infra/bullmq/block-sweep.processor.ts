import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';

/**
 * Block Sweep Processor (Mục V.1 - Retroactive Sweeping).
 *
 * Khi A chặn B, soft-delete (is_hidden = true) toàn bộ tương tác chéo:
 *  - Reaction của B trên post của A và của A trên post của B.
 *  - Comment của B trên post của A và của A trên post của B.
 *
 * Lưu ý: Đây là hành động PHÁ HỦY VĨNH VIỄN - unblock KHÔNG khôi phục.
 */
@Processor('block-sweep')
export class BlockSweepProcessor extends WorkerHost {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async process(job: Job<{ userA: string; userB: string }>): Promise<any> {
    const { userA, userB } = job.data;
    if (!userA || !userB) {
      return { success: false, reason: 'missing_user_ids' };
    }

    try {
      // Ẩn reactions chéo: reaction của X trên post của Y (cả 2 chiều)
      await this.dataSource.query(
        `
        UPDATE reaction r
        SET is_hidden = true
        FROM post p
        WHERE r.post_id = p.id
          AND (
            (r.user_id = $1 AND p.user_id = $2)
            OR (r.user_id = $2 AND p.user_id = $1)
          )
        `,
        [userA, userB],
      );

      // Ẩn reactions chéo trên comment: reaction của X trên comment của Y trên post của nhau
      await this.dataSource.query(
        `
        UPDATE reaction r
        SET is_hidden = true
        FROM comment c, post p
        WHERE r.comment_id = c.id
          AND c.post_id = p.id
          AND (
            (r.user_id = $1 AND p.user_id = $2)
            OR (r.user_id = $2 AND p.user_id = $1)
          )
        `,
        [userA, userB],
      );

      // Ẩn comments chéo: comment của X trên post của Y (cả 2 chiều)
      await this.dataSource.query(
        `
        UPDATE comment c
        SET is_hidden = true
        FROM post p
        WHERE c.post_id = p.id
          AND (
            (c.user_id = $1 AND p.user_id = $2)
            OR (c.user_id = $2 AND p.user_id = $1)
          )
        `,
        [userA, userB],
      );

      console.log(`[BlockSweep] Completed sweep between ${userA} and ${userB}`);
      return { success: true };
    } catch (error) {
      console.error('[BlockSweep] Error during sweep:', error);
      throw error;
    }
  }
}
