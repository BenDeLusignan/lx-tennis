-- The reviewer's email address (see /account in docs/vision.md). A null
-- email keeps working: the seeded reviewers get no value here until each
-- sets one on the account page. A plain ALTER rather than a table rebuild:
-- setup and review reference reviewer by id, so a copy-and-drop is riskier
-- than this additive change needs to be.
ALTER TABLE `reviewer` ADD `email` text CONSTRAINT "reviewer_email_trimmed" CHECK("email" IS NULL OR "email" = trim("email")) CONSTRAINT "reviewer_email_length" CHECK("email" IS NULL OR length("email") <= 254);--> statement-breakpoint
CREATE UNIQUE INDEX `reviewer_email_unique` ON `reviewer` (lower("email"));