ALTER TABLE `budget_lines` ADD `section_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `item_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `item_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `quantity` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `days` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `tax_pct` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `is_na` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_lines` ADD `na_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `category` text DEFAULT 'Uncategorized' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `square_feet` text DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `availability` text DEFAULT 'Availability Pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `blurb` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `gallery` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `deleted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `client_visible` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `contact` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `contact_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `billing_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `po_no` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `budget_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `budget_changes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `markup_pct` real DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `insurance_pct` real DEFAULT 5 NOT NULL;