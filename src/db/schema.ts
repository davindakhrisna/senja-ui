import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: varchar("id", { length: 191 }).primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id", { length: 191 }).primaryKey(),
  conversationId: varchar("conversation_id", { length: 191 })
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
