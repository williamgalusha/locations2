ALTER TABLE `locations` ADD `address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `locations` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `locations` ADD `maps_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `street_view_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `map_x` real DEFAULT -1 NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `map_y` real DEFAULT -1 NOT NULL;