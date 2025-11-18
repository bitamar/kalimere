DO $$
BEGIN
    CREATE TYPE "public"."visit_status" AS ENUM('scheduled', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "visit_treatments"
    ADD COLUMN IF NOT EXISTS "price_cents" integer;

ALTER TABLE "visits"
    ADD COLUMN IF NOT EXISTS "customer_id" uuid;

UPDATE "visits" AS v
SET "customer_id" = p."customer_id"
FROM "pets" AS p
WHERE v."customer_id" IS NULL
  AND v."pet_id" = p."id";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visits'
          AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE "visits" ALTER COLUMN "customer_id" SET NOT NULL;
    END IF;
END $$;

ALTER TABLE "visits"
    ADD COLUMN IF NOT EXISTS "status" "public"."visit_status";

UPDATE "visits"
SET "status" = 'scheduled'
WHERE "status" IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visits'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE "visits"
            ALTER COLUMN "status" SET DEFAULT 'scheduled',
            ALTER COLUMN "status" SET NOT NULL;
    END IF;
END $$;

ALTER TABLE "visits"
    ADD COLUMN IF NOT EXISTS "scheduled_start_at" timestamp with time zone;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visits'
          AND column_name = 'scheduled_start_at'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visits'
          AND column_name = 'visit_date'
    ) THEN
        UPDATE "visits"
        SET "scheduled_start_at" = COALESCE("scheduled_start_at", "visit_date"::timestamp with time zone);
    END IF;
END $$;

UPDATE "visits"
SET "scheduled_start_at" = COALESCE("scheduled_start_at", "created_at");

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visits'
          AND column_name = 'scheduled_start_at'
    ) THEN
        ALTER TABLE "visits" ALTER COLUMN "scheduled_start_at" SET NOT NULL;
    END IF;
END $$;

ALTER TABLE "visits"
    ADD COLUMN IF NOT EXISTS "scheduled_end_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "title" text,
    ADD COLUMN IF NOT EXISTS "description" text;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visits'
          AND column_name = 'visit_date'
    ) THEN
        ALTER TABLE "visits" DROP COLUMN "visit_date";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'visits'
          AND column_name = 'summary'
    ) THEN
        ALTER TABLE "visits" DROP COLUMN "summary";
    END IF;
END $$;

DO $$
BEGIN
    ALTER TABLE "visits"
        ADD CONSTRAINT "visits_customer_id_customers_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "visit_notes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "visit_id" uuid NOT NULL,
    "note" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
    ALTER TABLE "visit_notes"
        ADD CONSTRAINT "visit_notes_visit_id_visits_id_fk"
        FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "visit_note_visit_idx"
    ON "visit_notes" USING btree ("visit_id");

CREATE INDEX IF NOT EXISTS "visit_customer_idx"
    ON "visits" USING btree ("customer_id");

CREATE INDEX IF NOT EXISTS "visit_status_idx"
    ON "visits" USING btree ("status");

