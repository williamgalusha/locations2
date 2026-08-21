CREATE TABLE `library_files` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` real NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_files_object_key_idx` ON `library_files` (`object_key`);