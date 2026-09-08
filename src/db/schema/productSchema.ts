import { integer, pgTable, varchar, doublePrecision, text, timestamp } from "drizzle-orm/pg-core";

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

export const productVariantsTable = pgTable("product_variants", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "cascade" }).notNull(),
  weight: varchar({ length: 50 }).notNull(),
  price: doublePrecision().notNull(),
  status: varchar({ length: 50 }).default("active").notNull(),
});

export const ordersTable = pgTable("orders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  totalAmount: doublePrecision("total_amount").notNull(),
  taxAmount: doublePrecision("tax_amount").default(0.0).notNull(),
  status: varchar({ length: 50 }).default("pending").notNull(),
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending").notNull(),
  paymentGateway: varchar("payment_gateway", { length: 100 }),
  transactionId: varchar("transaction_id", { length: 255 }),
  customerName: varchar("customer_name", { length: 255 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 50 }),
  shippingAddress: text("shipping_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  variantId: integer("variant_id").references(() => productVariantsTable.id, { onDelete: "set null" }),
  quantity: integer().notNull(),
  priceAtPurchase: doublePrecision("price_at_purchase").notNull(),
  taxAtPurchase: doublePrecision("tax_at_purchase").notNull(),
});
