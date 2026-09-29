CREATE TABLE `racquet` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	CONSTRAINT "racquet_slug_format" CHECK(length("racquet"."slug") > 0 AND "racquet"."slug" NOT GLOB '*[^a-z0-9-]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `racquet_slug_unique` ON `racquet` (`slug`);--> statement-breakpoint
CREATE TABLE `review` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`setup_id` integer NOT NULL,
	`reviewer_id` integer NOT NULL,
	`power` integer NOT NULL,
	`control` integer NOT NULL,
	`comfort` integer NOT NULL,
	`spin` integer NOT NULL,
	`feel` integer NOT NULL,
	`body` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`setup_id`) REFERENCES `setup`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewer`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "review_power_valid" CHECK(typeof("review"."power") = 'integer' AND "review"."power" BETWEEN 1 AND 10),
	CONSTRAINT "review_control_valid" CHECK(typeof("review"."control") = 'integer' AND "review"."control" BETWEEN 1 AND 10),
	CONSTRAINT "review_comfort_valid" CHECK(typeof("review"."comfort") = 'integer' AND "review"."comfort" BETWEEN 1 AND 10),
	CONSTRAINT "review_spin_valid" CHECK(typeof("review"."spin") = 'integer' AND "review"."spin" BETWEEN 1 AND 10),
	CONSTRAINT "review_feel_valid" CHECK(typeof("review"."feel") = 'integer' AND "review"."feel" BETWEEN 1 AND 10),
	CONSTRAINT "review_body_not_blank" CHECK("review"."body" IS NULL OR length(trim("review"."body", ' ' || char(9, 10, 13))) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_setup_reviewer_unique` ON `review` (`setup_id`,`reviewer_id`);--> statement-breakpoint
CREATE TABLE `setup` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`racquet_id` integer NOT NULL,
	`strung_on` text NOT NULL,
	`tension_unit` text NOT NULL,
	`mains_string_id` integer NOT NULL,
	`mains_gauge_hundredths_mm` integer NOT NULL,
	`mains_tension_tenths` integer NOT NULL,
	`mains_tension_tenths_kg` integer GENERATED ALWAYS AS (CASE "tension_unit" WHEN 'kg' THEN "mains_tension_tenths" WHEN 'lb' THEN CAST(round("mains_tension_tenths" * 0.45359237) AS INTEGER) END) STORED NOT NULL,
	`crosses_string_id` integer NOT NULL,
	`crosses_gauge_hundredths_mm` integer NOT NULL,
	`crosses_tension_tenths` integer NOT NULL,
	`crosses_tension_tenths_kg` integer GENERATED ALWAYS AS (CASE "tension_unit" WHEN 'kg' THEN "crosses_tension_tenths" WHEN 'lb' THEN CAST(round("crosses_tension_tenths" * 0.45359237) AS INTEGER) END) STORED NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`racquet_id`) REFERENCES `racquet`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`mains_string_id`) REFERENCES `string`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`crosses_string_id`) REFERENCES `string`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `reviewer`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "setup_tension_unit_valid" CHECK("setup"."tension_unit" IN ('lb', 'kg')),
	CONSTRAINT "setup_strung_on_valid" CHECK(date("setup"."strung_on") IS "setup"."strung_on"),
	CONSTRAINT "setup_mains_gauge_valid" CHECK(typeof("setup"."mains_gauge_hundredths_mm") = 'integer' AND "setup"."mains_gauge_hundredths_mm" BETWEEN 100 AND 150),
	CONSTRAINT "setup_crosses_gauge_valid" CHECK(typeof("setup"."crosses_gauge_hundredths_mm") = 'integer' AND "setup"."crosses_gauge_hundredths_mm" BETWEEN 100 AND 150),
	CONSTRAINT "setup_mains_tension_valid" CHECK(typeof("setup"."mains_tension_tenths") = 'integer' AND CASE "setup"."tension_unit"
    WHEN 'lb' THEN "setup"."mains_tension_tenths" BETWEEN 300 AND 800
    WHEN 'kg' THEN "setup"."mains_tension_tenths" BETWEEN 136 AND 363 END),
	CONSTRAINT "setup_crosses_tension_valid" CHECK(typeof("setup"."crosses_tension_tenths") = 'integer' AND CASE "setup"."tension_unit"
    WHEN 'lb' THEN "setup"."crosses_tension_tenths" BETWEEN 300 AND 800
    WHEN 'kg' THEN "setup"."crosses_tension_tenths" BETWEEN 136 AND 363 END)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `setup_stringing_unique` ON `setup` (`racquet_id`,`strung_on`,`mains_string_id`,`mains_gauge_hundredths_mm`,`mains_tension_tenths_kg`,`crosses_string_id`,`crosses_gauge_hundredths_mm`,`crosses_tension_tenths_kg`);--> statement-breakpoint
CREATE INDEX `setup_mains_string_id_idx` ON `setup` (`mains_string_id`);--> statement-breakpoint
CREATE INDEX `setup_crosses_string_id_idx` ON `setup` (`crosses_string_id`);--> statement-breakpoint
CREATE TABLE `string` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	CONSTRAINT "string_brand_trimmed" CHECK(length("string"."brand") > 0 AND "string"."brand" = trim("string"."brand", ' ' || char(9, 10, 13))),
	CONSTRAINT "string_name_trimmed" CHECK(length("string"."name") > 0 AND "string"."name" = trim("string"."name", ' ' || char(9, 10, 13))),
	CONSTRAINT "string_type_valid" CHECK("string"."type" IN ('polyester', 'co-polyester', 'multifilament', 'synthetic-gut', 'natural-gut', 'kevlar-aramid'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `string_brand_name_unique` ON `string` (lower("brand"),lower("name"));