import { decimal, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const cartsTable = pgTable("carts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull(),
  status: varchar({ length: 50 }).notNull().default("active"),
  totalAmount: decimal({ precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const cartItemsTable = pgTable("cart_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cartId: integer().notNull(),
  productId: integer().notNull(),
  quantity: integer().notNull().default(1),
  unitPrice: decimal({ precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
