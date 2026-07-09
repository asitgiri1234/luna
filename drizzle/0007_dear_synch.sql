CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`timestamp` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `idx_activities_timestamp` ON `activities` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_activities_type` ON `activities` (`type`);