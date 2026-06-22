ALTER TABLE "audit_logs" ADD COLUMN "request_body" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "response_body" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "request_headers" text;