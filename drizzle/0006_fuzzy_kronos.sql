CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`last_used` integer,
	`updated_at` integer NOT NULL
);
