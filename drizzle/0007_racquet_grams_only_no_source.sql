-- Ben's decisions on racquets: unstrung weight is in grams only, and no
-- source link is kept ("we will always get it from the right place"). This
-- rebuilds `racquet` without `weight_ounces` and `source_url`, and without
-- their checks (`racquet_weight_ounces_valid`, `racquet_source_url_valid`,
-- `racquet_specs_have_source`). Every other column, id and row is copied as
-- it is, so `setup.racquet_id` keeps pointing at the same racquets. The
-- official pages the four built-in racquets' specs came from stay as
-- comments in 0006_racquets_in_database.sql, and the ounces and archive
-- links it inserted stay in that file's SQL as history.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_racquet` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`generation` text,
	`image_src` text NOT NULL,
	`image_alt` text NOT NULL,
	`head_size_sq_in` integer,
	`weight_grams` integer,
	`balance_mm` integer,
	`length_in` real,
	`string_mains` integer,
	`string_crosses` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `reviewer`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "racquet_slug_format" CHECK(length("__new_racquet"."slug") > 0 AND "__new_racquet"."slug" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "racquet_brand_valid" CHECK("__new_racquet"."brand" IN ('Yonex', 'Babolat', 'Head', 'Tecnifibre', 'Wilson')),
	CONSTRAINT "racquet_name_valid" CHECK(substr("__new_racquet"."name", 1, length("__new_racquet"."brand") + 1) = "__new_racquet"."brand" || ' '
        AND length(trim(substr("__new_racquet"."name", length("__new_racquet"."brand") + 2), ' ' || char(9, 10, 13))) > 0
        AND "__new_racquet"."name" = trim("__new_racquet"."name", ' ' || char(9, 10, 13))),
	CONSTRAINT "racquet_year_valid" CHECK(typeof("__new_racquet"."year") = 'integer' AND "__new_racquet"."year" BETWEEN 1990 AND 2100),
	CONSTRAINT "racquet_generation_valid" CHECK("__new_racquet"."generation" IS NULL OR (length(trim("__new_racquet"."generation", ' ' || char(9, 10, 13))) > 0 AND "__new_racquet"."generation" = trim("__new_racquet"."generation", ' ' || char(9, 10, 13)))),
	CONSTRAINT "racquet_image_valid" CHECK(length(trim("__new_racquet"."image_src", ' ' || char(9, 10, 13))) > 0 AND length(trim("__new_racquet"."image_alt", ' ' || char(9, 10, 13))) > 0),
	CONSTRAINT "racquet_head_size_valid" CHECK("__new_racquet"."head_size_sq_in" IS NULL OR (typeof("__new_racquet"."head_size_sq_in") IN ('integer') AND "__new_racquet"."head_size_sq_in" BETWEEN 70 AND 140)),
	CONSTRAINT "racquet_weight_grams_valid" CHECK("__new_racquet"."weight_grams" IS NULL OR (typeof("__new_racquet"."weight_grams") IN ('integer') AND "__new_racquet"."weight_grams" BETWEEN 150 AND 450)),
	CONSTRAINT "racquet_balance_valid" CHECK("__new_racquet"."balance_mm" IS NULL OR (typeof("__new_racquet"."balance_mm") IN ('integer') AND "__new_racquet"."balance_mm" BETWEEN 200 AND 450)),
	CONSTRAINT "racquet_length_valid" CHECK("__new_racquet"."length_in" IS NULL OR (typeof("__new_racquet"."length_in") IN ('real', 'integer') AND "__new_racquet"."length_in" BETWEEN 17 AND 29)),
	CONSTRAINT "racquet_string_mains_valid" CHECK("__new_racquet"."string_mains" IS NULL OR (typeof("__new_racquet"."string_mains") IN ('integer') AND "__new_racquet"."string_mains" BETWEEN 12 AND 24)),
	CONSTRAINT "racquet_string_crosses_valid" CHECK("__new_racquet"."string_crosses" IS NULL OR (typeof("__new_racquet"."string_crosses") IN ('integer') AND "__new_racquet"."string_crosses" BETWEEN 12 AND 24)),
	CONSTRAINT "racquet_string_pattern_pair" CHECK(("__new_racquet"."string_mains" IS NULL) = ("__new_racquet"."string_crosses" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_racquet`("id", "slug", "brand", "name", "year", "generation", "image_src", "image_alt", "head_size_sq_in", "weight_grams", "balance_mm", "length_in", "string_mains", "string_crosses", "created_by", "created_at") SELECT "id", "slug", "brand", "name", "year", "generation", "image_src", "image_alt", "head_size_sq_in", "weight_grams", "balance_mm", "length_in", "string_mains", "string_crosses", "created_by", "created_at" FROM `racquet`;--> statement-breakpoint
DROP TABLE `racquet`;--> statement-breakpoint
ALTER TABLE `__new_racquet` RENAME TO `racquet`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `racquet_slug_unique` ON `racquet` (`slug`);