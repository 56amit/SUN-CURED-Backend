import { decimal, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer().notNull(),
  userId: integer().notNull(),
  amount: decimal({ precision: 12, scale: 2 }).notNull(),
  currency: varchar({ length: 10 }).notNull().default("USD"),
  paymentMethod: varchar({ length: 50 }).notNull(),
  status: varchar({ length: 50 }).notNull().default("pending"),
  gatewayReference: varchar({ length: 255 }),
  errorMessage: text(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
