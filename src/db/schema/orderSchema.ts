import {
  decimal,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const ordersTable = pgTable("orders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull(),
  orderNumber: varchar({ length: 100 }).notNull().unique(),
  status: varchar({ length: 50 }).notNull().default("pending"),
  totalAmount: decimal({ precision: 12, scale: 2 }).notNull(),
  currency: varchar({ length: 10 }).notNull().default("USD"),
  shippingAddressId: integer(),
  billingAddressId: integer(),
  paymentStatus: varchar({ length: 50 }).notNull().default("unpaid"),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer().notNull(),
  productId: integer().notNull(),
  quantity: integer().notNull().default(1),
  unitPrice: decimal({ precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
