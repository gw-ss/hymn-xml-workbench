CREATE TABLE `hymn_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`title_zh_hant` text NOT NULL,
	`title_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hymn_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`hymn_id` text NOT NULL,
	`kind` text NOT NULL,
	`section_number` integer,
	`name_zh_hant` text NOT NULL,
	`name_en` text NOT NULL,
	`sequence` integer NOT NULL,
	`repeat_count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`hymn_id`) REFERENCES `hymns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hymns` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`edition_id` text NOT NULL,
	`number` integer NOT NULL,
	`title_zh_hant` text NOT NULL,
	`title_en` text NOT NULL,
	`category_path` text NOT NULL,
	`verse_count` integer NOT NULL,
	`chorus_structure` text NOT NULL,
	`review_status` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `hymn_collections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hymn_edition_number` ON `hymns` (`edition_id`,`number`);--> statement-breakpoint
CREATE TABLE `lyric_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`language` text NOT NULL,
	`text` text NOT NULL,
	`review_status` text NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `hymn_sections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lyric_section_language_sequence` ON `lyric_lines` (`section_id`,`language`,`sequence`);--> statement-breakpoint
CREATE TABLE `verse_chorus_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`hymn_id` text NOT NULL,
	`verse_section_id` text NOT NULL,
	`chorus_section_id` text,
	`chorus_order` integer DEFAULT 1 NOT NULL,
	`repeat_count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`hymn_id`) REFERENCES `hymns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verse_section_id`) REFERENCES `hymn_sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chorus_section_id`) REFERENCES `hymn_sections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verse_chorus_order` ON `verse_chorus_assignments` (`verse_section_id`,`chorus_order`);
--> statement-breakpoint
INSERT INTO `hymn_collections` (`id`,`title_zh_hant`,`title_en`) VALUES
  ('church-hymnal-en-tc','教會詩歌本','Church Hymnal');
--> statement-breakpoint
INSERT INTO `hymns` (`id`,`collection_id`,`edition_id`,`number`,`title_zh_hant`,`title_en`,`category_path`,`verse_count`,`chorus_structure`,`review_status`) VALUES
  ('hymn-002','church-hymnal-en-tc','church-hymnal-en-tc:002',2,'全能君王我神！','Come, Thou Almighty King,','讚美和敬拜 › 三一神 / Praise & Worship › The Trinity',4,'none','canonical'),
  ('hymn-175','church-hymnal-en-tc','church-hymnal-en-tc:175',175,'有一生命江河——從我裏湧流，','There’s a river of life flowing out thru me,','聖靈 › 活水 / Holy Spirit › Living Water',6,'shared','canonical');
--> statement-breakpoint
INSERT INTO `hymn_sections` (`id`,`hymn_id`,`kind`,`section_number`,`name_zh_hant`,`name_en`,`sequence`,`repeat_count`) VALUES
  ('002-v1','hymn-002','verse',1,'第 1 節','Verse 1',1,1),
  ('002-v2','hymn-002','verse',2,'第 2 節','Verse 2',2,1),
  ('002-v3','hymn-002','verse',3,'第 3 節','Verse 3',3,1),
  ('002-v4','hymn-002','verse',4,'第 4 節','Verse 4',4,1),
  ('175-v1','hymn-175','verse',1,'第 1 節','Verse 1',1,1),
  ('175-v2','hymn-175','verse',2,'第 2 節','Verse 2',2,1),
  ('175-v3','hymn-175','verse',3,'第 3 節','Verse 3',3,1),
  ('175-v4','hymn-175','verse',4,'第 4 節','Verse 4',4,1),
  ('175-v5','hymn-175','verse',5,'第 5 節','Verse 5',5,1),
  ('175-v6','hymn-175','verse',6,'第 6 節','Verse 6',6,1),
  ('175-chorus','hymn-175','chorus',NULL,'副歌','Chorus',7,1);
--> statement-breakpoint
INSERT INTO `verse_chorus_assignments` (`id`,`hymn_id`,`verse_section_id`,`chorus_section_id`,`chorus_order`,`repeat_count`) VALUES
  ('175-v1-c','hymn-175','175-v1','175-chorus',1,1),
  ('175-v2-c','hymn-175','175-v2','175-chorus',1,1),
  ('175-v3-c','hymn-175','175-v3','175-chorus',1,1),
  ('175-v4-c','hymn-175','175-v4','175-chorus',1,1),
  ('175-v5-c','hymn-175','175-v5','175-chorus',1,1),
  ('175-v6-c','hymn-175','175-v6','175-chorus',1,1);
