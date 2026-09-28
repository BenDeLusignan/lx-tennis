CREATE TABLE `reviewer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text,
	CONSTRAINT "reviewer_username_lowercase" CHECK("reviewer"."username" = lower("reviewer"."username")),
	CONSTRAINT "reviewer_display_name_not_blank" CHECK(length(trim("reviewer"."display_name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviewer_username_unique` ON `reviewer` (`username`);