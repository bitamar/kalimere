ALTER TABLE "visits" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
UPDATE "visits"
SET "customer_id" = p."customer_id"
FROM "pets" AS p
WHERE "visits"."pet_id" = p."id" AND "visits"."customer_id" IS NULL;--> statement-breakpoint
ALTER TABLE "visits"
  ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "visits"
  DROP CONSTRAINT IF EXISTS "visits_customer_id_customers_id_fk";--> statement-breakpoint
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_customer_id_customers_id_fk"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint
CREATE INDEX "visit_customer_idx" ON "visits" USING btree ("customer_id");
