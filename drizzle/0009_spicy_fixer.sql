CREATE INDEX `idx_library_files_category_created` ON `library_files` (`category`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
