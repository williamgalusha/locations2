ALTER TABLE `budget_versions` ADD `signed_off` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_versions` ADD `signed_off_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_versions` ADD `signed_off_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_versions` ADD `signed_off_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_versions` ADD `billing_percent` real DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_versions` ADD `payment_terms` text DEFAULT 'Net 30' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `source_version_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `source_label` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `billing_percent` real DEFAULT 100 NOT NULL;