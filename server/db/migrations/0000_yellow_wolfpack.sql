CREATE TYPE "public"."job_status" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb,
	"feed_items" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"cron" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"one_off" boolean DEFAULT false NOT NULL,
	"last_run" timestamp with time zone,
	"last_status" "job_status",
	"last_output" text,
	"next_run" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"claude_session_id" text,
	"system_prompt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_session_idx" ON "messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "messages_created_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_enabled_idx" ON "scheduled_jobs" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "jobs_next_run_idx" ON "scheduled_jobs" USING btree ("next_run");--> statement-breakpoint
CREATE INDEX "sessions_created_idx" ON "sessions" USING btree ("created_at");