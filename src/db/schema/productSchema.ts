import { integer, pgTable, varchar, doublePrecision, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  age: integer().notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
});

export const taxesTable = pgTable("taxes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  rate: doublePrecision().notNull(),
  desc: text(),
  status: varchar({ length: 50 }).default("active").notNull(),
});

export const categoriesTable = pgTable("categories", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  taxId: integer().references(() => taxesTable.id).notNull(),
  desc: text(),
  status: varchar({ length: 50 }).default("active").notNull(),
});

export const productsTable = pgTable("products", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  catId: integer().references(() => categoriesTable.id).notNull(),
  taxId: integer().references(() => taxesTable.id), // Nullable, can override category tax
  desc: text(),
  price: doublePrecision().notNull(),
  weight: varchar({ length: 50 }),
  img: text(),
  status: varchar({ length: 50 }).default("active").notNull(),
});

export const ordersTable = pgTable("orders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  totalAmount: doublePrecision().notNull(),
  taxAmount: doublePrecision().default(0.0).notNull(),
  status: varchar({ length: 50 }).default("pending").notNull(),
  paymentStatus: varchar({ length: 50 }).default("pending").notNull(),
  paymentGateway: varchar({ length: 100 }),
  transactionId: varchar({ length: 255 }),
  customerName: varchar({ length: 255 }),
  customerEmail: varchar({ length: 255 }),
  customerPhone: varchar({ length: 50 }),
  shippingAddress: text(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer().references(() => ordersTable.id, { onDelete: "cascade" }).notNull(),
  productId: integer().references(() => productsTable.id, { onDelete: "set null" }),
  quantity: integer().notNull(),
  priceAtPurchase: doublePrecision().notNull(),
  taxAtPurchase: doublePrecision().notNull(),
});
