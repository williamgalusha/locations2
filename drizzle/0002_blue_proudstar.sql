CREATE TABLE `budget_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL
);
