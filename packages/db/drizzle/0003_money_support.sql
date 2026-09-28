CREATE TABLE "dev_outbox_sms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_masked" text NOT NULL,
	"template" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"route" text NOT NULL,
	"request_sha256" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "access_tokens" ADD COLUMN "issued_by_post_id" uuid;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_issued_by_post_id_posts_id_fk" FOREIGN KEY ("issued_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;