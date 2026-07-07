CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`hash` text NOT NULL,
	`storage_location` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_files_hash` ON `files` (`hash`);