BEGIN;

DO $$
DECLARE
  invalid_count integer;
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM reaction
  WHERE user_id IS NOT NULL
    AND user_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'reaction.user_id has % invalid UUID values', invalid_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM reaction r
  WHERE r.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "user" u WHERE u.id = r.user_id::uuid
    );
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'reaction.user_id has % orphan values', orphan_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM notification
  WHERE target_id IS NOT NULL
    AND target_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'notification.target_id has % invalid UUID values', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM report
  WHERE reported_message_id IS NOT NULL
    AND reported_message_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'report.reported_message_id has % invalid UUID values', invalid_count;
  END IF;

  SELECT COUNT(*) INTO orphan_count
  FROM report r
  WHERE r.reported_message_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM chat_message cm WHERE cm.id = r.reported_message_id::uuid
    );
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'report.reported_message_id has % orphan values', orphan_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM post p
  CROSS JOIN LATERAL unnest(p.tagged_users) AS tag
  WHERE tag::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'post.tagged_users has % invalid UUID values', invalid_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM comment c
  CROSS JOIN LATERAL unnest(c.tagged_users) AS tag
  WHERE tag::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'comment.tagged_users has % invalid UUID values', invalid_count;
  END IF;
END $$;

ALTER TABLE reaction
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

ALTER TABLE notification
  ALTER COLUMN target_id TYPE uuid USING target_id::uuid;

ALTER TABLE report
  ALTER COLUMN reported_message_id TYPE uuid USING reported_message_id::uuid;

ALTER TABLE post
  ALTER COLUMN tagged_users DROP DEFAULT;

ALTER TABLE post
  ALTER COLUMN tagged_users TYPE uuid[]
    USING CASE
      WHEN tagged_users IS NULL THEN '{}'::uuid[]
      ELSE tagged_users::uuid[]
    END,
  ALTER COLUMN tagged_users SET DEFAULT '{}'::uuid[],
  ALTER COLUMN tagged_users SET NOT NULL;

ALTER TABLE comment
  ALTER COLUMN tagged_users DROP DEFAULT;

ALTER TABLE comment
  ALTER COLUMN tagged_users TYPE uuid[]
    USING CASE
      WHEN tagged_users IS NULL THEN '{}'::uuid[]
      ELSE tagged_users::uuid[]
    END,
  ALTER COLUMN tagged_users SET DEFAULT '{}'::uuid[],
  ALTER COLUMN tagged_users SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'reaction'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE reaction
      ADD CONSTRAINT fk_reaction_user_id
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'report'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'reported_message_id'
  ) THEN
    ALTER TABLE report
      ADD CONSTRAINT fk_report_reported_message_id
      FOREIGN KEY (reported_message_id) REFERENCES chat_message(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reaction_user_id ON reaction(user_id);
CREATE INDEX IF NOT EXISTS idx_report_reported_message_id ON report(reported_message_id);

COMMIT;
