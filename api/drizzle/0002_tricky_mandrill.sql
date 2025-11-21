CREATE TABLE "visit_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text,
	"content_type" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visits" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "visit_images" ADD CONSTRAINT "visit_images_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_image_visit_idx" ON "visit_images" USING btree ("visit_id");