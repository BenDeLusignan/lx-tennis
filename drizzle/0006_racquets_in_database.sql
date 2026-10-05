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
	`weight_ounces` real,
	`balance_mm` integer,
	`length_in` real,
	`string_mains` integer,
	`string_crosses` integer,
	`source_url` text,
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
	CONSTRAINT "racquet_weight_ounces_valid" CHECK("__new_racquet"."weight_ounces" IS NULL OR (typeof("__new_racquet"."weight_ounces") IN ('real', 'integer') AND "__new_racquet"."weight_ounces" BETWEEN 5 AND 16)),
	CONSTRAINT "racquet_balance_valid" CHECK("__new_racquet"."balance_mm" IS NULL OR (typeof("__new_racquet"."balance_mm") IN ('integer') AND "__new_racquet"."balance_mm" BETWEEN 200 AND 450)),
	CONSTRAINT "racquet_length_valid" CHECK("__new_racquet"."length_in" IS NULL OR (typeof("__new_racquet"."length_in") IN ('real', 'integer') AND "__new_racquet"."length_in" BETWEEN 17 AND 29)),
	CONSTRAINT "racquet_string_mains_valid" CHECK("__new_racquet"."string_mains" IS NULL OR (typeof("__new_racquet"."string_mains") IN ('integer') AND "__new_racquet"."string_mains" BETWEEN 12 AND 24)),
	CONSTRAINT "racquet_string_crosses_valid" CHECK("__new_racquet"."string_crosses" IS NULL OR (typeof("__new_racquet"."string_crosses") IN ('integer') AND "__new_racquet"."string_crosses" BETWEEN 12 AND 24)),
	CONSTRAINT "racquet_string_pattern_pair" CHECK(("__new_racquet"."string_mains" IS NULL) = ("__new_racquet"."string_crosses" IS NULL)),
	CONSTRAINT "racquet_source_url_valid" CHECK("__new_racquet"."source_url" IS NULL OR ("__new_racquet"."source_url" LIKE 'https://_%' AND length("__new_racquet"."source_url") <= 500 AND "__new_racquet"."source_url" NOT GLOB '*[ ' || char(9, 10, 13) || ']*')),
	CONSTRAINT "racquet_specs_have_source" CHECK("__new_racquet"."source_url" IS NOT NULL OR ("__new_racquet"."head_size_sq_in" IS NULL AND "__new_racquet"."weight_grams" IS NULL AND "__new_racquet"."weight_ounces" IS NULL AND "__new_racquet"."balance_mm" IS NULL AND "__new_racquet"."length_in" IS NULL AND "__new_racquet"."string_mains" IS NULL))
);
--> statement-breakpoint
-- Move the four built-in racquets' specs, photos and sources out of
-- src/data/racquets.ts into the table. Each existing row keeps its id (setups
-- point at it). The LEFT JOIN means a racquet row with no data below fails
-- the NOT NULL columns loudly instead of being dropped. The official pages
-- the specs came from are kept as comments next to each row; source_url holds
-- the archived copy of each (the manufacturers have since replaced the
-- pages), which Product rule 10 allows.
WITH `v`(slug, brand, name, year, generation, image_src, image_alt, head_size_sq_in, weight_grams, weight_ounces, balance_mm, length_in, string_mains, string_crosses, source_url) AS (VALUES
	-- Specs: official Yonex product page, item code 07EZ98
	--   https://www.yonex.com/tennis/racquets/ezone-98-07ez98
	--   (same values for these specs in https://web.archive.org/web/20240810100806/https://www.yonex.com/tennis/racquets/ezone-98-07ez98)
	-- Image: Sky Blue launch colourway, listed on the page above
	--   https://www.yonex.com/media/catalog/product/0/7/07ez98.png
	('yonex-ezone-98-2022', 'Yonex', 'Yonex EZONE 98', 2022, '7th gen',
		'/images/racquets/yonex-ezone-98-2022.webp',
		'Yonex EZONE 98 (2022) racquet in sky blue and navy, head up, face-on',
		98, 305, 10.8, 315, 27, 16, 19,
		'https://web.archive.org/web/20220129095929/https://www.yonex.com/tennis/racquets/ezone-98-07ez98'),
	-- Specs: official Yonex product page, item code 07VC98
	--   https://www.yonex.com/tennis/racquets/vcore/07vc98
	-- Image: Scarlet launch colourway, from Yonex USA's 07VC98 product page
	--   https://us.yonex.com/cdn/shop/files/07vc98_in_02.png
	--   (page: https://web.archive.org/web/20250317040121/https://us.yonex.com/products/vcore-98)
	('yonex-vcore-98-2023', 'Yonex', 'Yonex VCORE 98', 2023, '7th gen',
		'/images/racquets/yonex-vcore-98-2023.webp',
		'Yonex VCORE 98 (2023) racquet in scarlet red, head up, face-on',
		98, 305, 10.8, 315, 27, 16, 19,
		'https://web.archive.org/web/20250123005803/https://www.yonex.com/tennis/racquets/vcore/07vc98'),
	-- Specs: official Yonex product page, item code 01PE97
	--   https://www.yonex.com/tennis/racquets/percept-97
	--   Head size, balance, length and pattern also current on https://us.yonex.com/products/percept-97
	-- Image: Olive Green launch colourway, listed on the yonex.com page above
	--   https://www.yonex.com/media/catalog/product/i/n/int_01pe97_268-1_1.png
	('yonex-percept-97-2023', 'Yonex', 'Yonex PERCEPT 97', 2023, NULL,
		'/images/racquets/yonex-percept-97-2023.webp',
		'Yonex PERCEPT 97 (2023) racquet in olive green, head up, face-on',
		97, 310, 10.9, 310, 27, 16, 19,
		'https://web.archive.org/web/20240722194555/https://www.yonex.com/tennis/racquets/percept-97'),
	-- Specs: official Babolat US product page, item 101499 (unstrung)
	--   https://www.babolat.com/us/pure-aero-98-unstrung/101499.html
	--   The US page is the one that publishes the imperial values (98 in², 27 in, 10.7586 oz);
	--   the UK/FR pages give metric only. Weight and balance are published as ±7 g / ±7 mm;
	--   the site shows the nominal value only. The ounces are kept as published (4 decimals);
	--   the racquet page rounds them to 1 dp for display.
	-- Generation: "eighth-generation" on the official UK page for the same item
	--   https://web.archive.org/web/20230127021819/https://www.babolat.com/gb/pure-aero-98-unstrung/101499.html
	-- Image: Grey Yellow White launch colourway (code 370), face-on shot from the US page above
	--   https://media.babolat.com/image/upload/v1651570894/Product_Media/2023/TENNIS_RACKETS/EXPERT/101499-Pure_Aero_98-370-1-Face.png
	('babolat-pure-aero-98-2023', 'Babolat', 'Babolat Pure Aero 98', 2023, '8th gen',
		'/images/racquets/babolat-pure-aero-98-2023.webp',
		'Babolat Pure Aero 98 (2023) racquet in grey, neon yellow and white, head up, face-on',
		98, 305, 10.7586, 315, 27, 16, 20,
		'https://web.archive.org/web/20230203095246/https://www.babolat.com/us/pure-aero-98-unstrung/101499.html')
)
INSERT INTO `__new_racquet`("id", "slug", "brand", "name", "year", "generation", "image_src", "image_alt", "head_size_sq_in", "weight_grams", "weight_ounces", "balance_mm", "length_in", "string_mains", "string_crosses", "source_url") SELECT r.id, r.slug, v.brand, v.name, v.year, v.generation, v.image_src, v.image_alt, v.head_size_sq_in, v.weight_grams, v.weight_ounces, v.balance_mm, v.length_in, v.string_mains, v.string_crosses, v.source_url FROM `racquet` r LEFT JOIN `v` ON v.slug = r.slug;--> statement-breakpoint
DROP TABLE `racquet`;--> statement-breakpoint
ALTER TABLE `__new_racquet` RENAME TO `racquet`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `racquet_slug_unique` ON `racquet` (`slug`);