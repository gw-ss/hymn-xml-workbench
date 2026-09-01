CREATE TABLE `hymn_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`parent_id` text,
	`title_zh_hant` text NOT NULL,
	`title_en` text NOT NULL,
	`sequence` integer NOT NULL,
	`source_type` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `hymn_collections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hymn_category_assignments` (
	`hymn_id` text NOT NULL,
	`category_id` text NOT NULL,
	FOREIGN KEY (`hymn_id`) REFERENCES `hymns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `hymn_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hymn_category_assignment` ON `hymn_category_assignments` (`hymn_id`,`category_id`);
--> statement-breakpoint
INSERT INTO `hymn_categories` (`id`,`collection_id`,`parent_id`,`title_zh_hant`,`title_en`,`sequence`,`source_type`) VALUES
  ('praise-worship','church-hymnal-en-tc',NULL,'讚美和敬拜','Praise and Worship',1,'pdf_outline'),
  ('holy-spirit','church-hymnal-en-tc',NULL,'聖靈','Holy Spirit',2,'pdf_outline'),
  ('word-of-god','church-hymnal-en-tc',NULL,'神的話','The Word of God',3,'pdf_outline'),
  ('prayer','church-hymnal-en-tc',NULL,'禱告','Prayer',4,'pdf_outline'),
  ('church-life','church-hymnal-en-tc',NULL,'教會生活','Church Life',5,'pdf_outline'),
  ('joy-salvation','church-hymnal-en-tc',NULL,'救恩的喜樂','Joy of Salvation',6,'pdf_outline'),
  ('loving-lord','church-hymnal-en-tc',NULL,'愛慕主','Loving the Lord',7,'pdf_outline'),
  ('seeking-lord','church-hymnal-en-tc',NULL,'尋求主','Seeking the Lord',8,'pdf_outline'),
  ('consecration','church-hymnal-en-tc',NULL,'奉獻歸主','Consecration',9,'pdf_outline'),
  ('experience-christ','church-hymnal-en-tc',NULL,'經歷主','Experience of Christ',10,'pdf_outline'),
  ('experience-god','church-hymnal-en-tc',NULL,'經歷神','Experience of God',11,'pdf_outline'),
  ('way-cross','church-hymnal-en-tc',NULL,'十字架的道路','The Way of the Cross',12,'pdf_outline'),
  ('comfort','church-hymnal-en-tc',NULL,'安慰與鼓勵','Comfort and Encouragement',13,'pdf_outline'),
  ('warfare','church-hymnal-en-tc',NULL,'屬靈的爭戰','Spiritual Warfare',14,'pdf_outline'),
  ('hope-glory','church-hymnal-en-tc',NULL,'榮耀的盼望','Hope of Glory',15,'pdf_outline'),
  ('gospel','church-hymnal-en-tc',NULL,'福音','Gospel',16,'pdf_outline'),
  ('preaching-gospel','church-hymnal-en-tc',NULL,'傳揚福音','Preaching the Gospel',17,'pdf_outline'),
  ('psalms-scripture','church-hymnal-en-tc',NULL,'詩篇與經文片段','Psalms and Scripture Passages',18,'pdf_outline');
--> statement-breakpoint
INSERT INTO `hymn_category_assignments` (`hymn_id`,`category_id`) VALUES
  ('hymn-002','praise-worship'),
  ('hymn-175','holy-spirit');
