import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from 'src/modules/posts/entities/post.entity';

/**
 * Idempotently provisions the Postgres objects needed for accent-insensitive,
 * trigram-based search. `synchronize: true` cannot create extensions, IMMUTABLE
 * wrapper functions, or expression GIN indexes, so we run them here once at
 * startup. Every statement uses IF NOT EXISTS / OR REPLACE, so re-runs are safe.
 */
@Injectable()
export class SearchIndexBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexBootstrap.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async onModuleInit(): Promise<void> {
    const statements = [
      `CREATE EXTENSION IF NOT EXISTS unaccent`,
      `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
      // Immutable wrapper so unaccent() can be used inside an index expression.
      `CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS
         $$ SELECT public.unaccent('public.unaccent', $1) $$
       LANGUAGE sql IMMUTABLE PARALLEL SAFE`,
      // array_to_string không IMMUTABLE -> bọc riêng trong hàm IMMUTABLE (giữ
      // f_unaccent+lower TRỰC TIẾP trong biểu thức index như các index còn lại).
      `CREATE OR REPLACE FUNCTION imm_array_join(text[]) RETURNS text AS
         $$ SELECT array_to_string($1, ',') $$
       LANGUAGE sql IMMUTABLE PARALLEL SAFE`,
      `CREATE INDEX IF NOT EXISTS idx_post_content_trgm
         ON post USING gin (f_unaccent(lower(content)) gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_user_username_trgm
         ON "user" USING gin (f_unaccent(lower(username)) gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS idx_user_fullname_trgm
         ON "user" USING gin (f_unaccent(lower(full_name)) gin_trgm_ops)`,
      // Hashtag: khớp substring không dấu trên chuỗi nối các tag -> cần GIN trigram.
      // (Thay cho unnest+ILIKE vốn seq-scan; khớp với biểu thức trong SearchService.)
      `CREATE INDEX IF NOT EXISTS idx_post_hashtags_trgm
         ON post USING gin (f_unaccent(lower(imm_array_join(hashtags))) gin_trgm_ops)`,
    ];

    for (const sql of statements) {
      try {
        await this.postRepository.manager.query(sql);
      } catch (error) {
        // Don't crash the app if the DB user lacks CREATE EXTENSION rights;
        // search still works (queries degrade to a sequential scan).
        this.logger.warn(
          `Search index bootstrap statement failed (continuing): ${
            (error as Error)?.message
          }`,
        );
      }
    }
    this.logger.log('Search trigram indexes ensured (unaccent + pg_trgm).');
  }
}
