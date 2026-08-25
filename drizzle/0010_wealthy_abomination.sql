CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`amount` real NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`terms` text DEFAULT 'Net 30' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoices_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_invoices_project_status` ON `invoices` (`project_id`,`status`);--> statement-breakpoint
PRAGMA optimize;
