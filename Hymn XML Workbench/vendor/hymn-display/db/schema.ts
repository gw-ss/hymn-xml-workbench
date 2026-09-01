import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const hymnCollections = sqliteTable("hymn_collections", {
  id: text("id").primaryKey(),
  titleZhHant: text("title_zh_hant").notNull(),
  titleEn: text("title_en").notNull(),
});

export const hymns = sqliteTable("hymns", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id").notNull().references(() => hymnCollections.id),
  editionId: text("edition_id").notNull(),
  number: integer("number").notNull(),
  titleZhHant: text("title_zh_hant").notNull(),
  titleEn: text("title_en").notNull(),
  categoryPath: text("category_path").notNull(),
  verseCount: integer("verse_count").notNull(),
  chorusStructure: text("chorus_structure", { enum: ["none", "shared", "per_verse", "grouped"] }).notNull(),
  reviewStatus: text("review_status", { enum: ["draft", "canonical"] }).notNull(),
}, (table) => [uniqueIndex("hymn_edition_number").on(table.editionId, table.number)]);

export const hymnCategories = sqliteTable("hymn_categories", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id").notNull().references(() => hymnCollections.id),
  parentId: text("parent_id"),
  titleZhHant: text("title_zh_hant").notNull(),
  titleEn: text("title_en").notNull(),
  sequence: integer("sequence").notNull(),
  sourceType: text("source_type", { enum: ["pdf_outline", "editorial"] }).notNull(),
});

export const hymnCategoryAssignments = sqliteTable("hymn_category_assignments", {
  hymnId: text("hymn_id").notNull().references(() => hymns.id),
  categoryId: text("category_id").notNull().references(() => hymnCategories.id),
}, (table) => [uniqueIndex("hymn_category_assignment").on(table.hymnId, table.categoryId)]);

export const hymnSections = sqliteTable("hymn_sections", {
  id: text("id").primaryKey(),
  hymnId: text("hymn_id").notNull().references(() => hymns.id),
  kind: text("kind", { enum: ["verse", "chorus", "refrain"] }).notNull(),
  sectionNumber: integer("section_number"),
  nameZhHant: text("name_zh_hant").notNull(),
  nameEn: text("name_en").notNull(),
  sequence: integer("sequence").notNull(),
  repeatCount: integer("repeat_count").notNull().default(1),
});

export const lyricLines = sqliteTable("lyric_lines", {
  id: text("id").primaryKey(),
  sectionId: text("section_id").notNull().references(() => hymnSections.id),
  sequence: integer("sequence").notNull(),
  language: text("language", { enum: ["zh-Hant", "en"] }).notNull(),
  text: text("text").notNull(),
  reviewStatus: text("review_status", { enum: ["draft", "canonical"] }).notNull(),
}, (table) => [uniqueIndex("lyric_section_language_sequence").on(table.sectionId, table.language, table.sequence)]);

export const verseChorusAssignments = sqliteTable("verse_chorus_assignments", {
  id: text("id").primaryKey(),
  hymnId: text("hymn_id").notNull().references(() => hymns.id),
  verseSectionId: text("verse_section_id").notNull().references(() => hymnSections.id),
  chorusSectionId: text("chorus_section_id").references(() => hymnSections.id),
  chorusOrder: integer("chorus_order").notNull().default(1),
  repeatCount: integer("repeat_count").notNull().default(1),
}, (table) => [uniqueIndex("verse_chorus_order").on(table.verseSectionId, table.chorusOrder)]);
