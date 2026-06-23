DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'report_admin_action_enum'
  ) THEN
    CREATE TYPE report_admin_action_enum AS ENUM (
      'no_action',
      'warn_reported',
      'remove_post',
      'lock_user'
    );
  END IF;
END $$;

ALTER TABLE report
  ADD COLUMN IF NOT EXISTS admin_action report_admin_action_enum NULL,
  ADD COLUMN IF NOT EXISTS resolved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_report_resolved_by_user'
  ) THEN
    ALTER TABLE report
      ADD CONSTRAINT fk_report_resolved_by_user
      FOREIGN KEY (resolved_by)
      REFERENCES "user"(id)
      ON DELETE SET NULL;
  END IF;
END $$;
