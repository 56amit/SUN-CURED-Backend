import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import db from "../db/config/db.connect";
import { ordersTable, productsTable, taxesTable } from "../db/schema/productSchema";
import { eq } from "drizzle-orm";

const isProduction = process.env.NODE_ENV === "production";

const razorpayKeyId = isProduction
  ? (process.env.RAZORPAY_KEY_ID_LIVE as string)
  : (process.env.RAZORPAY_KEY_ID_TEST as string);

const razorpayKeySecret = isProduction
  ? (process.env.RAZORPAY_KEY_SECRET_LIVE as string)
  : (process.env.RAZORPAY_KEY_SECRET_TEST as string);

console.log(`💳 Razorpay: Running in ${isProduction ? "🔴 LIVE" : "🟡 TEST"} mode`);

const razorpayInstance = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart items are missing or empty." });
    }

    let calculatedTotal = 0;

    for (const item of items) {
      const [product] = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, parseInt(item.productId)))
        .limit(1);

      if (!product) {
        return res.status(404).json({ error: `Product ID ${item.productId} not found.` });
      }

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
    }

    // Add shipping cost (Rs 40)
    calculatedTotal += 40;

    const options = {
      amount: Math.round(calculatedTotal * 100),
      currency: "INR",
      receipt: `receipt_init_${Date.now()}`,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    return res.status(200).json({
      success: true,
      key_id: razorpayKeyId,        // ← frontend ko dynamically milegi
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error: any) {
    console.error("Razorpay initiation error:", error);
    return res.status(500).json({ error: "Could not initiate Razorpay payment" });
  }
};


export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const secret = razorpayKeySecret;

    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature === razorpay_signature) {
      // Payment is successful, update DB order status
      await db
        .update(ordersTable)
        .set({ status: "paid", paymentGateway: "razorpay" })
        .where(eq(ordersTable.id, parseInt(orderId)));

      return res.status(200).json({ success: true, message: "Payment verified successfully" });
    } else {
      return res.status(400).json({ success: false, error: "Invalid signature, payment failed" });
    }
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ error: "Payment verification failed" });
  }
};
