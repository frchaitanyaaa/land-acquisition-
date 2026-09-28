ALTER TABLE "ocr_extractions" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ocr_extractions" ADD COLUMN "last_error" text;