CREATE TABLE `chunk_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`chunk_id` text NOT NULL,
	`model` text NOT NULL,
	`dimensions` integer NOT NULL,
	`embedding` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `document_chunks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chunk_embeddings_chunk` ON `chunk_embeddings` (`chunk_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chunk_embeddings_chunk_model` ON `chunk_embeddings` (`chunk_id`,`model`);