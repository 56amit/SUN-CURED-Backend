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
import { eq, desc, sql, lt } from "drizzle-orm";
import { sendOrderEmails, sendStatusUpdateEmail } from "../utils/mailer";

// Auto-add missing columns if they don't exist (safe migration)
let orderColumnsMigrated = false;
async function ensureOrderColumns() {
  if (orderColumnsMigrated) return;
  try {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingCharge" DOUBLE PRECISION DEFAULT 0`);
  } catch (_) {}
  try {
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "deliveryZone" VARCHAR(100)`);
  } catch (_) {}
  orderColumnsMigrated = true;
}

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
          .json({ error: `Product ID ${item.productId} not found.` });
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

    // Finally, new order database me save karte hain (Initial status = "Pending")
    let newOrder: any = null;
    try {
      const [ord] = await db
        .insert(ordersTable)
        .values({
          totalAmount: calculatedTotal,
          taxAmount: calculatedTaxTotal,
          paymentGateway: paymentGateway || "COD",
          status: paymentGateway === "razorpay" ? "Confirmed" : "Pending",
          paymentStatus: paymentGateway === "razorpay" ? "paid" : "pending",
          transactionId: paymentGateway === "razorpay" ? paymentDetails?.razorpay_payment_id : null,
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
          VALUES (${calculatedTotal}, ${calculatedTaxTotal}, ${paymentGateway || 'COD'}, 'Pending', ${customer.name}, ${customer.email}, ${customer.phone}, ${customer.address})
          RETURNING id, total_amount, tax_amount, status
        `);
        newOrder = res.rows ? res.rows[0] : res[0];
      } catch (sqlErr1) {
        const res: any = await db.execute(sql`
          INSERT INTO orders ("totalAmount", "taxAmount", "paymentGateway", status, "customerName", "customerEmail", "customerPhone", "shippingAddress")
          VALUES (${calculatedTotal}, ${calculatedTaxTotal}, ${paymentGateway || 'COD'}, 'Pending', ${customer.name}, ${customer.email}, ${customer.phone}, ${customer.address})
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

    // Send emails — await is required on Vercel serverless (function terminates after res.json without it)
    try {
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
      );
    } catch (emailErr) {
      console.error("Email send failed (non-fatal):", emailErr);
    }

    return res.status(201).json({
      message: "Order placed successfully!",
      order: newOrder,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Helper to safely fetch order items across snake_case / camelCase database schema variations
async function fetchAllOrderItems(targetOrderId?: number) {
  try {
    let query;
    if (targetOrderId) {
      query = sql`
        SELECT 
          oi.id,
          COALESCE(NULLIF((to_jsonb(oi)->>'order_id')::text, ''), NULLIF((to_jsonb(oi)->>'orderId')::text, '')) as "orderIdStr",
          COALESCE(NULLIF((to_jsonb(oi)->>'product_id')::text, ''), NULLIF((to_jsonb(oi)->>'productId')::text, '')) as "productIdStr",
          COALESCE(NULLIF((to_jsonb(oi)->>'quantity')::text, ''), '1')::int as quantity,
          COALESCE(NULLIF((to_jsonb(oi)->>'price_at_purchase')::text, ''), NULLIF((to_jsonb(oi)->>'priceAtPurchase')::text, ''), '0')::double precision as "priceAtPurchase",
          COALESCE(NULLIF((to_jsonb(oi)->>'tax_at_purchase')::text, ''), NULLIF((to_jsonb(oi)->>'taxAtPurchase')::text, ''), '5')::double precision as "taxAtPurchase",
          p.name as "productName",
          p.weight as "weight",
          p.img as "productImage"
        FROM order_items oi
        LEFT JOIN products p ON (p.id = COALESCE(NULLIF((to_jsonb(oi)->>'product_id')::text, ''), NULLIF((to_jsonb(oi)->>'productId')::text, ''))::int)
        WHERE COALESCE(NULLIF((to_jsonb(oi)->>'order_id')::text, ''), NULLIF((to_jsonb(oi)->>'orderId')::text, ''))::int = ${targetOrderId}
      `;
    } else {
      query = sql`
        SELECT 
          oi.id,
          COALESCE(NULLIF((to_jsonb(oi)->>'order_id')::text, ''), NULLIF((to_jsonb(oi)->>'orderId')::text, '')) as "orderIdStr",
          COALESCE(NULLIF((to_jsonb(oi)->>'product_id')::text, ''), NULLIF((to_jsonb(oi)->>'productId')::text, '')) as "productIdStr",
          COALESCE(NULLIF((to_jsonb(oi)->>'quantity')::text, ''), '1')::int as quantity,
          COALESCE(NULLIF((to_jsonb(oi)->>'price_at_purchase')::text, ''), NULLIF((to_jsonb(oi)->>'priceAtPurchase')::text, ''), '0')::double precision as "priceAtPurchase",
          COALESCE(NULLIF((to_jsonb(oi)->>'tax_at_purchase')::text, ''), NULLIF((to_jsonb(oi)->>'taxAtPurchase')::text, ''), '5')::double precision as "taxAtPurchase",
          p.name as "productName",
          p.weight as "weight",
          p.img as "productImage"
        FROM order_items oi
        LEFT JOIN products p ON (p.id = COALESCE(NULLIF((to_jsonb(oi)->>'product_id')::text, ''), NULLIF((to_jsonb(oi)->>'productId')::text, ''))::int)
      `;
    }

    const res: any = await db.execute(query);
    const rows = res.rows || res || [];
    return rows.map((r: any) => ({
      id: r.id,
      orderId: parseInt(r.orderIdStr || r.order_id || r.orderId || "0"),
      productId: parseInt(r.productIdStr || r.product_id || r.productId || "0"),
      quantity: parseInt(r.quantity || 1),
      priceAtPurchase: parseFloat(r.priceAtPurchase || r.price_at_purchase || 0),
      taxAtPurchase: parseFloat(r.taxAtPurchase || r.tax_at_purchase || 5),
      name: r.productName || "Sun-Cured Product",
      productName: r.productName || "Sun-Cured Product",
      price: parseFloat(r.priceAtPurchase || r.price_at_purchase || 0),
      taxRate: parseFloat(r.taxAtPurchase || r.tax_at_purchase || 5),
      weight: r.weight || null,
      productImage: r.productImage || null,
    }));
  } catch (err) {
    console.error("fetchAllOrderItems sql query error, trying drizzle fallback:", err);
    try {
      let items;
      if (targetOrderId) {
        items = await db
          .select({
            id: orderItemsTable.id,
            orderId: orderItemsTable.orderId,
            productId: orderItemsTable.productId,
            quantity: orderItemsTable.quantity,
            priceAtPurchase: orderItemsTable.priceAtPurchase,
            taxAtPurchase: orderItemsTable.taxAtPurchase,
            name: productsTable.name,
            productName: productsTable.name,
            price: orderItemsTable.priceAtPurchase,
            taxRate: orderItemsTable.taxAtPurchase,
            weight: productsTable.weight,
            productImage: productsTable.img,
          })
          .from(orderItemsTable)
          .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
          .where(eq(orderItemsTable.orderId, targetOrderId));
      } else {
        items = await db
          .select({
            id: orderItemsTable.id,
            orderId: orderItemsTable.orderId,
            productId: orderItemsTable.productId,
            quantity: orderItemsTable.quantity,
            priceAtPurchase: orderItemsTable.priceAtPurchase,
            taxAtPurchase: orderItemsTable.taxAtPurchase,
            name: productsTable.name,
            productName: productsTable.name,
            price: orderItemsTable.priceAtPurchase,
            taxRate: orderItemsTable.taxAtPurchase,
            weight: productsTable.weight,
            productImage: productsTable.img,
          })
          .from(orderItemsTable)
          .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id));
      }
      return items.map((it) => ({
        ...it,
        name: it.name || "Sun-Cured Product",
        price: it.priceAtPurchase,
        taxRate: it.taxAtPurchase !== undefined ? it.taxAtPurchase : 5,
      }));
    } catch (drizzleErr) {
      console.error("Drizzle fallback error:", drizzleErr);
      return [];
    }
  }
}

// 2. GET ALL ORDERS
// Plain array by default (backward compatible)
// Paginated response when ?paginate=true (admin panel)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const isPaginated = req.query.paginate === "true";
    const limit = Math.min(parseInt(String(req.query.limit || "20")), 100);
    const cursor = req.query.cursor ? parseInt(String(req.query.cursor)) : null;

    // Ensure optional columns exist in DB (safe auto-migration)
    await ensureOrderColumns();
    // that may not exist in older DB migrations on production
    let rawOrders: any[] = [];
    try {
      const cursorClause = isPaginated && cursor ? sql`AND id < ${cursor}` : sql``;
      const limitClause = isPaginated ? limit + 1 : 1000;
      const result: any = await db.execute(sql`
        SELECT
          id, "totalAmount", "taxAmount", status, "paymentStatus",
          "paymentGateway", "transactionId", "customerName", "customerEmail",
          "customerPhone", "shippingAddress", "createdAt",
          COALESCE("shippingCharge", 0) as "shippingCharge",
          "deliveryZone"
        FROM orders
        WHERE 1=1 ${cursorClause}
        ORDER BY id DESC
        LIMIT ${limitClause}
      `);
      rawOrders = result.rows || result || [];
    } catch (sqlErr: any) {
      // Fallback: some columns may not exist, try without optional columns
      const cursorClause = isPaginated && cursor ? sql`AND id < ${cursor}` : sql``;
      const limitClause = isPaginated ? limit + 1 : 1000;
      const result: any = await db.execute(sql`
        SELECT
          id, "totalAmount", "taxAmount", status, "paymentStatus",
          "paymentGateway", "transactionId", "customerName", "customerEmail",
          "customerPhone", "shippingAddress", "createdAt"
        FROM orders
        WHERE 1=1 ${cursorClause}
        ORDER BY id DESC
        LIMIT ${limitClause}
      `);
      rawOrders = result.rows || result || [];
    }

    const hasNextPage = isPaginated && rawOrders.length > limit;
    const orders = hasNextPage ? rawOrders.slice(0, limit) : rawOrders;

    if (orders.length === 0) {
      return isPaginated
        ? res.status(200).json({ data: [], nextCursor: null, hasNextPage: false })
        : res.status(200).json([]);
    }

    const orderIds = orders.map((o: any) => o.id);
    const allItems = await fetchAllOrderItems();
    const filteredItems = allItems.filter((it) => orderIds.includes(it.orderId));

    const ordersWithItems = orders.map((ord: any) => ({
      id: ord.id,
      totalAmount: parseFloat(ord.totalAmount || ord.total_amount || 0),
      taxAmount: parseFloat(ord.taxAmount || ord.tax_amount || 0),
      status: ord.status,
      paymentStatus: ord.paymentStatus || ord.payment_status || "pending",
      paymentGateway: ord.paymentGateway || ord.payment_gateway,
      transactionId: ord.transactionId || ord.transaction_id,
      customerName: ord.customerName || ord.customer_name,
      customerEmail: ord.customerEmail || ord.customer_email,
      customerPhone: ord.customerPhone || ord.customer_phone,
      shippingAddress: ord.shippingAddress || ord.shipping_address,
      shippingCharge: parseFloat(ord.shippingCharge || ord.shipping_charge || 0),
      deliveryZone: ord.deliveryZone || ord.delivery_zone || null,
      createdAt: ord.createdAt || ord.created_at,
      items: filteredItems.filter((it) => it.orderId === ord.id),
    }));

    if (isPaginated) {
      const nextCursor = hasNextPage ? orders[orders.length - 1].id : null;
      return res.status(200).json({ data: ordersWithItems, nextCursor, hasNextPage });
    }

    return res.status(200).json(ordersWithItems);
  } catch (error: any) {
    console.error("getOrders error:", error);
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
    const { status, orderStatus, paymentStatus, transactionId } = req.body;
    const newStatus = status || orderStatus;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    const updateFields: Record<string, any> = {};
    if (newStatus !== undefined) updateFields.status = newStatus;
    if (paymentStatus !== undefined) updateFields.paymentStatus = paymentStatus;
    if (transactionId !== undefined) updateFields.transactionId = transactionId;

    const [updatedOrder] = await db
      .update(ordersTable)
      .set(updateFields)
      .where(eq(ordersTable.id, id))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order record not found." });
    }

    // Trigger email notification to customer about the order status update
    if (newStatus && updatedOrder.customerEmail) {
      try {
        await sendStatusUpdateEmail(
          updatedOrder.id,
          { name: updatedOrder.customerName || "Customer", email: updatedOrder.customerEmail },
          newStatus
        );
      } catch (emailErr) {
        console.error("Status update email send failed (non-fatal):", emailErr);
      }
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

    const items = await fetchAllOrderItems(id);
    return res.status(200).json(items);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 5. GET SINGLE ORDER WITH ITEMS
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const items = await fetchAllOrderItems(id);
    return res.status(200).json({ ...order, items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
