CREATE TABLE `portal_user_projects` (
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`permission` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `project_id`)
);
--> statement-breakpoint
CREATE TABLE `portal_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`access_level` text NOT NULL,
	`active` real DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_user_username_idx` ON `portal_users` (`username`);