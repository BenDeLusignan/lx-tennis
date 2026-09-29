-- The racquet line-up (Product rule 13): one row per slug in
-- src/data/racquets.ts, in getRacquetSlugs() order. Adding a racquet there
-- needs a new migration that inserts its slug; never edit this one.
INSERT INTO `racquet` (`slug`) VALUES
	('yonex-ezone-98-2022'),
	('yonex-vcore-98-2023'),
	('yonex-percept-97-2023'),
	('babolat-pure-aero-98-2023');
--> statement-breakpoint
-- Ben's starting ten strings (Product rule 14), named as the manufacturer
-- writes them, with the manufacturer's type.
INSERT INTO `string` (`brand`, `name`, `type`) VALUES
	('Yonex', 'POLYTOUR PRO', 'polyester'),
	('Yonex', 'POLYTOUR FIRE', 'polyester'),
	('Yonex', 'POLYTOUR DRIVE', 'polyester'),
	('Yonex', 'POLYTOUR REV', 'polyester'),
	('Yonex', 'POLYTOUR SPIN', 'polyester'),
	('Solinco', 'Hyper-G', 'co-polyester'),
	('Solinco', 'Hyper-G Soft', 'co-polyester'),
	('Solinco', 'Confidential', 'co-polyester'),
	('Solinco', 'Confidential Soft', 'co-polyester'),
	('Solinco', 'Mach-10', 'co-polyester');
