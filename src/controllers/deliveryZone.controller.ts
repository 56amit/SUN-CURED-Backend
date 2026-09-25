import { Request, Response } from "express";
import db from "../db/config/db.connect";
import { deliveryZonesTable } from "../db/schema/productSchema";
import { eq, sql } from "drizzle-orm";

// Helper: DB mein table exist nahi to create kar do
async function ensureDeliveryZonesTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        pincodes TEXT NOT NULL DEFAULT '',
        charge DOUBLE PRECISION NOT NULL DEFAULT 0,
        min_order_free_delivery DOUBLE PRECISION DEFAULT 0,
        estimated_days VARCHAR(50) DEFAULT '2-3 Days',
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
  } catch (err) {
    // Table already exists — ignore
  }
}

// ── 1. GET ALL DELIVERY ZONES (Public + Admin) ──
export const getDeliveryZones = async (req: Request, res: Response) => {
  try {
    await ensureDeliveryZonesTable();
    const zones = await db.select().from(deliveryZonesTable).orderBy(deliveryZonesTable.charge);
    return res.status(200).json(zones);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// ── 2. CHECK PINCODE → Returns zone + shipping charge ──
// Frontend checkout pe use hoga: GET /api/delivery-zones/check?pincode=122052&subtotal=350
export const checkPincode = async (req: Request, res: Response) => {
  try {
    await ensureDeliveryZonesTable();

    const pincode = String(req.query.pincode || "").trim();
    const subtotal = parseFloat(String(req.query.subtotal || "0"));

    if (!pincode || pincode.length < 4) {
      return res.status(400).json({ error: "Valid pincode required" });
    }

    const allZones = await db
      .select()
      .from(deliveryZonesTable)
      .where(eq(deliveryZonesTable.isActive, true));

    // Pincode match karo
    const matchedZone = allZones.find((zone) => {
      const zonePincodes = zone.pincodes
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      return zonePincodes.includes(pincode);
    });

    if (!matchedZone) {
      return res.status(200).json({
        serviceable: false,
        message: "Sorry! We don't deliver to this pincode yet.",
        pincode,
      });
    }

    // Free delivery check
    const minFree = matchedZone.minOrderFreeDelivery || 0;
    const shippingCharge =
      minFree > 0 && subtotal >= minFree ? 0 : matchedZone.charge;

    return res.status(200).json({
      serviceable: true,
      zone: {
        id: matchedZone.id,
        name: matchedZone.name,
        estimatedDays: matchedZone.estimatedDays,
      },
      shippingCharge,
      isFreeDelivery: shippingCharge === 0,
      freeDeliveryAbove: minFree > 0 ? minFree : null,
      pincode,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// ── 3. CREATE DELIVERY ZONE (Admin) ──
export const createDeliveryZone = async (req: Request, res: Response) => {
  try {
    await ensureDeliveryZonesTable();

    const { name, pincodes, charge, minOrderFreeDelivery, estimatedDays, isActive } = req.body;

    if (!name || pincodes === undefined || charge === undefined) {
      return res.status(400).json({ error: "Name, pincodes, and charge are required." });
    }

    // Normalize pincodes: trim spaces
    const normalizedPincodes = String(pincodes)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .join(",");

    const [newZone] = await db
      .insert(deliveryZonesTable)
      .values({
        name,
        pincodes: normalizedPincodes,
        charge: parseFloat(String(charge)),
        minOrderFreeDelivery: parseFloat(String(minOrderFreeDelivery || 0)),
        estimatedDays: estimatedDays || "2-3 Days",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      })
      .returning();

    return res.status(201).json(newZone);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// ── 4. UPDATE DELIVERY ZONE (Admin) ──
export const updateDeliveryZone = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "Invalid zone ID" });

    const { name, pincodes, charge, minOrderFreeDelivery, estimatedDays, isActive } = req.body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (pincodes !== undefined) {
      updateData.pincodes = String(pincodes).split(",").map((p) => p.trim()).filter(Boolean).join(",");
    }
    if (charge !== undefined) updateData.charge = parseFloat(String(charge));
    if (minOrderFreeDelivery !== undefined) updateData.minOrderFreeDelivery = parseFloat(String(minOrderFreeDelivery));
    if (estimatedDays !== undefined) updateData.estimatedDays = estimatedDays;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const [updated] = await db
      .update(deliveryZonesTable)
      .set(updateData)
      .where(eq(deliveryZonesTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Delivery zone not found." });

    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// ── 5. DELETE DELIVERY ZONE (Admin) ──
export const deleteDeliveryZone = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "Invalid zone ID" });

    const [deleted] = await db
      .delete(deliveryZonesTable)
      .where(eq(deliveryZonesTable.id, id))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Delivery zone not found." });

    return res.status(200).json({ message: "Delivery zone deleted successfully.", id: deleted.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
