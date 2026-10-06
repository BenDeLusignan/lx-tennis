-- Ben's decision: a string's first letter is always capitalised. The site
-- now does that when a string is added or edited (`src/data/strings.ts`);
-- this brings the rows that were saved before to the same form. Only the
-- first character of the brand and of the name is uppercased, the rest is
-- left exactly as typed (POLYTOUR PRO, Hyper-G, Mach-10).
--
-- Additive and idempotent: it changes no schema, and a row whose first
-- character is already uppercase, a digit, a symbol or a non-ASCII letter
-- is not touched (SQLite's upper() only knows ASCII; the site itself
-- handles any letter). Running it again changes nothing.
--
-- It cannot collide with the unique index on lower(brand), lower(name):
-- uppercasing a first letter doesn't change its lowercase form.
UPDATE `string`
SET `brand` = upper(substr(`brand`, 1, 1)) || substr(`brand`, 2)
WHERE `brand` <> upper(substr(`brand`, 1, 1)) || substr(`brand`, 2);--> statement-breakpoint
UPDATE `string`
SET `name` = upper(substr(`name`, 1, 1)) || substr(`name`, 2)
WHERE `name` <> upper(substr(`name`, 1, 1)) || substr(`name`, 2);
