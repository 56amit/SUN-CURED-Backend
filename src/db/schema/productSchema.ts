import { integer, pgTable, varchar, doublePrecision, text, timestamp, boolean } from "drizzle-orm/pg-core";

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
  taxId: integer().references(() => taxesTable.id),
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
  totalAmount: doublePrecision().notNull(),
  taxAmount: doublePrecision().default(0.0).notNull(),
  status: varchar({ length: 50 }).default("confirmed").notNull(),
  paymentStatus: varchar({ length: 50 }).default("pending").notNull(),
  paymentGateway: varchar({ length: 100 }),
  transactionId: varchar({ length: 255 }),
  customerName: varchar({ length: 255 }),
  customerEmail: varchar({ length: 255 }),
  customerPhone: varchar({ length: 50 }),
  shippingAddress: text(),
  shippingCharge: doublePrecision().default(0).notNull(),
  deliveryZone: varchar({ length: 100 }),
  createdAt: timestamp().defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer().references(() => ordersTable.id, { onDelete: "cascade" }).notNull(),
  productId: integer().references(() => productsTable.id, { onDelete: "set null" }),
  variantId: integer().references(() => productVariantsTable.id, { onDelete: "set null" }),
  quantity: integer().notNull(),
  priceAtPurchase: doublePrecision().notNull(),
  taxAtPurchase: doublePrecision().notNull(),
});

// ── Delivery Zones Table ──
// Admin yahan se pincode-based zones manage kar sakta hai
export const deliveryZonesTable = pgTable("delivery_zones", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 100 }).notNull(),          // e.g., "Local (Manesar)", "Gurgaon City", "Delhi NCR"
  pincodes: text().notNull(),                         // comma-separated: "122052,122051,122001"
  charge: doublePrecision().notNull().default(0),     // shipping charge in ₹
  minOrderFreeDelivery: doublePrecision().default(0), // min order amt for free delivery (0 = always paid)
  estimatedDays: varchar({ length: 50 }).default("2-3 Days"), // "Same Day", "1-2 Days", etc.
  isActive: boolean().default(true).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});
