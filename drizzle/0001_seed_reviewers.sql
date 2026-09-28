-- The three reviewer accounts (Product rule 7 in docs/vision.md). No password
-- is set here: a null hash can't log in until `npm run db:set-password` sets one.
-- Adding accounts beyond these three is an open question, so there is no
-- other way to create one.
INSERT INTO `reviewer` (`username`, `display_name`) VALUES
	('ben', 'Ben'),
	('michal', 'Michal'),
	('otavio', 'Otavio');
