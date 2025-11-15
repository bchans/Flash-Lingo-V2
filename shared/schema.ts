import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  sourceText: text("source_text").notNull(),
  targetText: text("target_text").notNull(),
  explanation: text("explanation").notNull(),
  sourceLang: text("source_lang").notNull(),
  targetLang: text("target_lang").notNull(),
  type: text("type", { enum: ["word", "sentence"] }).notNull().default("word"),
  category: text("category"),
  categoryEmoji: text("category_emoji"),
  createdAt: timestamp("created_at").defaultNow(),
  learned: boolean("learned").default(false),
  proficiency: integer("proficiency").default(0),
  lastStudied: timestamp("last_studied"),
  cachedScenarios: text("cached_scenarios").array(),
  hasScenario: boolean("has_scenario").default(false),
  audioFileSource: text("audio_file_source"), // Base64 encoded audio for source text
  audioFileTarget: text("audio_file_target"), // Base64 encoded audio for target text
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
}).partial({
  createdAt: true,
  proficiency: true,
  lastStudied: true,
  learned: true,
  hasScenario: true,
  cachedScenarios: true,
  audioFileSource: true,
  audioFileTarget: true,
  category: true,
  categoryEmoji: true,
  type: true
});

export const grammarLessons = pgTable("grammar_lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  explanation: text("explanation").notNull(),
  exercises: text("exercises").notNull(), // JSON string of exercise array
  newWords: text("new_words").array(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;
export type GrammarLesson = typeof grammarLessons.$inferSelect;
export type InsertGrammarLesson = typeof grammarLessons.$inferInsert;


// Schema for Mistral AI translation request
export const translationRequestSchema = z.object({
  text: z.string().min(1),
  sourceLang: z.string(),
  targetLang: z.string(),
});

export type TranslationRequest = z.infer<typeof translationRequestSchema>;