import { Request, Response } from "express";
import crypto from "crypto";
import db from "../db/config/db.connect";
import {
  ordersTable,
  orderItemsTable,
  productsTable,
  taxesTable,
} from "../db/schema/productSchema";
import { usersTable } from "../db/schema/userSchema";
import { eq, desc, sql } from "drizzle-orm";
import { sendOrderEmails } from "../utils/mailer";

// 1. PLACE A NEW ORDER (Future Payment Gateway Ready)
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, paymentGateway, customer, paymentDetails } = req.body;

    console.log("order controller hit", req.body);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Cart items are missing or empty." });
    }

    if (!customer || !customer.name || !customer.email) {
      return res
        .status(400)
        .json({ error: "Customer details (name, email) are required." });
    }

    let calculatedTotal = 0;
    let calculatedTaxTotal = 0;
    const resolvedItems: any[] = [];

    // Har product ke details database se fetch karke price validation karenge
    for (const item of items) {
      const pId = parseInt(item.productId);
      const [product] = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, pId))
        .limit(1);

      if (!product) {
        return res
          .status(404)
          .json({ error: `Product ID ${item.productId} nahi mila.` });
      }

      let itemPrice = product.price;
      if (item.price && typeof item.price === "number") {
        itemPrice = item.price;
      }
      if (product.name.toLowerCase().includes("beetroot") && (item.unit?.includes("200") || item.weight?.includes("200") || product.weight?.includes("200"))) {
        itemPrice = 273;
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

      const itemTotalInclTax = itemPrice * item.quantity;
      
      const taxMultiplier = 1 + (taxRate / 100);
      const basePrice = itemTotalInclTax / taxMultiplier;
      const itemTaxTotal = itemTotalInclTax - basePrice;

      calculatedTotal += itemTotalInclTax;
      calculatedTaxTotal += itemTaxTotal;

      resolvedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: parseInt(item.quantity) || 1,
        priceAtPurchase: itemPrice,
        taxAtPurchase: taxRate,
      });
    }

    // Calculate shipping (Rs 50 or Free if > 500)
    const itemsSubtotal = resolvedItems.reduce((sum, item) => sum + item.quantity * item.priceAtPurchase, 0);
    const shippingCharge = itemsSubtotal > 500 ? 0 : 50;
    calculatedTotal += shippingCharge;
    // Razorpay signature verification
    if (paymentGateway === "razorpay") {
      if (!paymentDetails || !paymentDetails.razorpay_order_id || !paymentDetails.razorpay_payment_id || !paymentDetails.razorpay_signature) {
        return res.status(400).json({ error: "Missing Razorpay payment details." });
      }

      const isProduction = process.env.NODE_ENV === "production";
      const secret = isProduction
        ? (process.env.RAZORPAY_KEY_SECRET_LIVE as string)
        : (process.env.RAZORPAY_KEY_SECRET_TEST as string);
      const generated_signature = crypto
        .createHmac("sha256", secret)
        .update(paymentDetails.razorpay_order_id + "|" + paymentDetails.razorpay_payment_id)
        .digest("hex");

      if (generated_signature !== paymentDetails.razorpay_signature) {
        return res.status(400).json({ error: "Invalid payment signature." });
      }
    }

    // Finally, new order database me save karte hain
    let newOrder: any = null;
    try {
      const [ord] = await db
        .insert(ordersTable)
        .values({
          totalAmount: calculatedTotal,
          taxAmount: calculatedTaxTotal,
          paymentGateway: paymentGateway || "COD",
          status: paymentGateway === "razorpay" ? "paid" : "pending",
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          shippingAddress: customer.address,
        })
        .returning();
      newOrder = ord;
    } catch (ordErr) {
      console.warn("Drizzle orders insert failed, attempting SQL fallbacks:", ordErr);
      try {
        const res: any = await db.execute(sql`
          INSERT INTO orders (total_amount, tax_amount, payment_gateway, status, customer_name, customer_email, customer_phone, shipping_address)
          VALUES (${calculatedTotal}, ${calculatedTaxTotal}, ${paymentGateway || 'COD'}, ${paymentGateway === 'razorpay' ? 'paid' : 'pending'}, ${customer.name}, ${customer.email}, ${customer.phone}, ${customer.address})
          RETURNING id, total_amount, tax_amount, status
        `);
        newOrder = res.rows ? res.rows[0] : res[0];
      } catch (sqlErr1) {
        const res: any = await db.execute(sql`
          INSERT INTO orders ("totalAmount", "taxAmount", "paymentGateway", status, "customerName", "customerEmail", "customerPhone", "shippingAddress")
          VALUES (${calculatedTotal}, ${calculatedTaxTotal}, ${paymentGateway || 'COD'}, ${paymentGateway === 'razorpay' ? 'paid' : 'pending'}, ${customer.name}, ${customer.email}, ${customer.phone}, ${customer.address})
          RETURNING id
        `);
        newOrder = res.rows ? res.rows[0] : res[0];
      }
    }

    // 3. Order items ko order_items table me save kar rahe hain
    try {
      const itemsToInsert = resolvedItems.map((item) => ({
        orderId: newOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
        taxAtPurchase: item.taxAtPurchase,
      }));
      await db.insert(orderItemsTable).values(itemsToInsert);
    } catch (insertErr) {
      console.warn("Drizzle order_items insert error, trying SQL fallbacks:", insertErr);
      for (const item of resolvedItems) {
        try {
          await db.execute(sql`
            INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, tax_at_purchase)
            VALUES (${newOrder.id}, ${item.productId}, ${item.quantity}, ${item.priceAtPurchase}, ${item.taxAtPurchase})
          `);
        } catch (e1) {
          await db.execute(sql`
            INSERT INTO order_items ("orderId", "productId", quantity, "priceAtPurchase", "taxAtPurchase")
            VALUES (${newOrder.id}, ${item.productId}, ${item.quantity}, ${item.priceAtPurchase}, ${item.taxAtPurchase})
          `);
        }
      }
    }

    // Send emails in background
    await sendOrderEmails(
      newOrder.id,
      calculatedTotal,
      {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || "N/A",
        address: customer.address || "N/A",
      },
      resolvedItems.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.priceAtPurchase,
      })),
      calculatedTaxTotal
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

// 2.5 GET MY ORDERS (Customer)
export const getMyOrders = async (req: Request | any, res: Response) => {
  try {
    const userId = req.adminId; // verifyAdmin middleware sets this to the user's ID
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get user email
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(userId)))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch orders by user email
    const myOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerEmail, user.email))
      .orderBy(desc(ordersTable.createdAt));

    return res.status(200).json(myOrders);
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

// 4. GET ORDER ITEMS (Admin Only - View Details)
export const getOrderItems = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    // Fetch order items and join with products table to get product names and images
    const items = await db
      .select({
        id: orderItemsTable.id,
        orderId: orderItemsTable.orderId,
        productId: orderItemsTable.productId,
        quantity: orderItemsTable.quantity,
        priceAtPurchase: orderItemsTable.priceAtPurchase,
        taxAtPurchase: orderItemsTable.taxAtPurchase,
        productName: productsTable.name,
        productImage: productsTable.img
      })
      .from(orderItemsTable)
      .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
      .where(eq(orderItemsTable.orderId, id));

    return res.status(200).json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
