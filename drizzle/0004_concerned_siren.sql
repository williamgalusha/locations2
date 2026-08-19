CREATE TABLE `budget_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `file_assets` ADD `budget_line_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `file_assets` ADD `expense_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `file_assets` ADD `vendor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `file_assets` ADD `amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `file_assets` ADD `spend_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `file_assets` ADD `memo` text DEFAULT '' NOT NULL;