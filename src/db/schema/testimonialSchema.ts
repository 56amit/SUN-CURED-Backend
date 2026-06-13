import { integer, pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./userSchema";

export const testimonialsTable = pgTable("testimonials", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().references(() => usersTable.id).notNull(),
  rating: integer().notNull(), // 1 to 5
  content: text().notNull(),
  status: varchar({ length: 50 }).default("pending").notNull(), // "pending", "approved", "rejected"
  createdAt: timestamp().defaultNow().notNull(),
});
