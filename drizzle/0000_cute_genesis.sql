CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budget_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`estimate` real NOT NULL,
	`actual` real NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`budget_line_id` text NOT NULL,
	`vendor` text NOT NULL,
	`amount` real NOT NULL,
	`spend_date` text NOT NULL,
	`status` text NOT NULL,
	`memo` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`rate` real NOT NULL,
	`status` text NOT NULL,
	`image_url` text NOT NULL,
	`tags` text NOT NULL,
	`note` text NOT NULL,
	`client_note` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client` text NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`shoot_start` text NOT NULL,
	`shoot_end` text NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL
);
