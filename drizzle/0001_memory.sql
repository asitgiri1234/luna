CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used` integer,
	`source_conversation_id` text,
	`is_archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`source_conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_memories_category` ON `memories` (`category`);--> statement-breakpoint
CREATE TABLE `memory_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`tokens` text NOT NULL,
	`created_at` integer NOT NULL
);
