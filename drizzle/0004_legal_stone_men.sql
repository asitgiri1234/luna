CREATE TABLE `document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_document_chunks_document` ON `document_chunks` (`document_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`source_file_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`language` text NOT NULL,
	`word_count` integer NOT NULL,
	`page_count` integer NOT NULL,
	`paragraph_count` integer NOT NULL,
	`reading_time_minutes` integer NOT NULL,
	`author` text,
	`document_created_at` integer,
	`chunk_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_documents_source_file` ON `documents` (`source_file_id`);