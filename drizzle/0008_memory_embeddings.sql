CREATE TABLE `memory_embeddings` (
	`memory_id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`dimensions` integer NOT NULL,
	`embedding` text NOT NULL,
	`source_updated_at` integer NOT NULL,
	FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON UPDATE no action ON DELETE cascade
);
