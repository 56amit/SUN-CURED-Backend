import { Request, Response } from "express";
import db from "../db/config/db.connect";
import {
  ordersTable,
  orderItemsTable,
  productsTable,
  taxesTable,
} from "../db/schema/productSchema";
import { eq, desc } from "drizzle-orm";
import { sendOrderEmails } from "../utils/mailer";

// 1. PLACE A NEW ORDER (Future Payment Gateway Ready)
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, paymentGateway, customer } = req.body; // items = [{ productId: 1, quantity: 2 }, ...]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Cart items are missing or empty." });
    }

    if (!customer || !customer.name || !customer.email) {
      return res.status(400).json({ error: "Customer details (name, email) are required." });
    }

    let calculatedTotal = 0;
    let calculatedTaxTotal = 0;
    const resolvedItems: any[] = [];

    // Har product ke details database se fetch karke price validation karenge
    for (const item of items) {
      const [product] = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, parseInt(item.productId)))
        .limit(1);

      if (!product) {
        return res
          .status(404)
          .json({ error: `Product ID ${item.productId} nahi mila.` });
      }

      // Tax rate fetch kar rahe hain jo product/category pe mapped hai
      let taxRate = 0;
      const targetTaxId = product.taxId;
      if (targetTaxId) {
        const [tax] = await db
          .select()
          .from(taxesTable)
          .where(eq(taxesTable.id, targetTaxId))
          .limit(1);
        if (tax) taxRate = tax.rate;
      }

      const itemPriceTotal = product.price * item.quantity;
      const itemTaxTotal = (itemPriceTotal * taxRate) / 100;

      calculatedTotal += itemPriceTotal + itemTaxTotal;
      calculatedTaxTotal += itemTaxTotal;

      resolvedItems.push({
        productId: product.id,
        quantity: item.quantity,
        priceAtPurchase: product.price,
        taxAtPurchase: taxRate,
      });
    }

    // Calculate shipping (Rs 40 hardcoded in frontend)
    calculatedTotal += 40;

    // Finally, new order database me save karte hain
    const [newOrder] = await db
      .insert(ordersTable)
      .values({
        totalAmount: calculatedTotal,
        taxAmount: calculatedTaxTotal,
        paymentGateway: paymentGateway || "COD",
        status: "pending",
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        shippingAddress: customer.address
      })
      .returning();

    // 3. Order items ko order_items table me save kar rahe hain (Foreign Key relation ke sath)
    const itemsToInsert = resolvedItems.map((item) => ({
      orderId: newOrder.id,
      productId: item.productId,
      quantity: item.quantity,
      priceAtPurchase: item.priceAtPurchase,
      taxAtPurchase: item.taxAtPurchase,
    }));

    await db.insert(orderItemsTable).values(itemsToInsert);

    // Send emails in background
    sendOrderEmails(
      newOrder.id,
      calculatedTotal,
      {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || 'N/A',
        address: customer.address || 'N/A',
      },
      items.length
    ).catch(console.error);

    return res.status(201).json({
      message: "Order placed successfully!",
      order: newOrder,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. GET ALL ORDERS (Admin Only)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const allOrders = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.id));
    return res.status(200).json(allOrders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. UPDATE ORDER STATUS (Admin Only - e.g. Mark as Paid or Completed)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status, paymentStatus, transactionId } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    const [updatedOrder] = await db
      .update(ordersTable)
      .set({
        status,
        paymentStatus,
        transactionId,
      })
      .where(eq(ordersTable.id, id))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order record nahi mila." });
    }

    return res.status(200).json(updatedOrder);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
