CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`remind_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`notified` integer DEFAULT false NOT NULL
);
