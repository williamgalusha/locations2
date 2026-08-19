CREATE TABLE `file_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` real NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `module_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`module` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
