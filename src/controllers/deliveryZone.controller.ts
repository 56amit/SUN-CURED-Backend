import { Request, Response } from "express";
import { Pool } from "pg";
import db from "../db/config/db.connect";
import { sql } from "drizzle-orm";

// Get the underlying pg client for dynamic queries
let pgPool: Pool | null = null;
async function getPgPool(): Promise<Pool> {
  if (pgPool) return pgPool;
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pgPool;
}

export function formatEstimatedDays(val: any): string {
  if (!val) return "2-3 Days";
  const s = String(val).trim();
  if (!s) return "2-3 Days";
  if (/^\d+$/.test(s)) return `${s} Hr`;
  return s;
}

// Ensure the delivery_zones table exists before every operation
async function ensureDeliveryZonesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS delivery_zones (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      pincodes TEXT NOT NULL DEFAULT '',
      charge DOUBLE PRECISION NOT NULL DEFAULT 0,
      min_order_free_delivery DOUBLE PRECISION DEFAULT 0,
      estimated_days VARCHAR(50) DEFAULT '2-3 Days',
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  try {
    await db.execute(sql`
      UPDATE delivery_zones
      SET estimated_days = CONCAT(TRIM(estimated_days), ' Hr')
      WHERE estimated_days ~ '^[0-9]+$'
    `);
  } catch {
    // Ignore migration error if already updated or regex unsupported
  }
}

// Map snake_case DB row to camelCase response
function mapZone(row: any) {
  return {
    id: row.id,
    name: row.name,
    pincodes: row.pincodes,
    charge: parseFloat(row.charge) || 0,
    minOrderFreeDelivery: parseFloat(row.min_order_free_delivery) || 0,
    estimatedDays: formatEstimatedDays(row.estimated_days),
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// ── 1. GET ALL DELIVERY ZONES (Public + Admin) ──
export const getDeliveryZones = async (req: Request, res: Response) => {
  try {
    await ensureDeliveryZonesTable();
    const result = await db.execute(sql`
      SELECT * FROM delivery_zones ORDER BY charge ASC
    `);
    const zones = (result.rows || result as any[]).map(mapZone);
    return res.status(200).json(zones);
  } catch (error: any) {
    console.error("getDeliveryZones error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ── 2. CHECK PINCODE → Returns zone + shipping charge ──
// Frontend checkout use: GET /api/delivery-zones/check?pincode=122052&subtotal=350
export const checkPincode = async (req: Request, res: Response) => {
  try {
    await ensureDeliveryZonesTable();

    const pincode = String(req.query.pincode || "").trim();
    const subtotal = parseFloat(String(req.query.subtotal || "0"));

    if (!pincode || pincode.length < 4) {
      return res.status(400).json({ error: "Valid pincode required" });
    }

    const result = await db.execute(sql`
      SELECT * FROM delivery_zones WHERE is_active = TRUE
    `);
    const allZones = (result.rows || result as any[]).map(mapZone);

    const matchedZone = allZones.find((zone) => {
      const zonePincodes = zone.pincodes
        .split(",")
        .map((p: string) => p.trim())
        .filter(Boolean);
      return zonePincodes.includes(pincode);
    });

    if (!matchedZone) {
      // Pincode is outside local admin delivery zones -> Pan India delivery with standard shipping charge
      const panIndiaShippingCharge = 50;
      return res.status(200).json({
        serviceable: true,
        zone: {
          id: 0,
          name: "Pan India Delivery",
          estimatedDays: "4-7 Days",
        },
        shippingCharge: panIndiaShippingCharge,
        isFreeDelivery: false,
        freeDeliveryAbove: null,
        pincode,
      });
    }

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
    console.error("checkPincode error:", error);
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

    const normalizedPincodes = String(pincodes)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .join(",");

    const result = await db.execute(sql`
      INSERT INTO delivery_zones (name, pincodes, charge, min_order_free_delivery, estimated_days, is_active)
      VALUES (
        ${name},
        ${normalizedPincodes},
        ${parseFloat(String(charge))},
        ${parseFloat(String(minOrderFreeDelivery || 0))},
        ${formatEstimatedDays(estimatedDays)},
        ${isActive !== undefined ? Boolean(isActive) : true}
      )
      RETURNING *
    `);

    const rows = result.rows || result as any[];
    const newZone = rows[0] ? mapZone(rows[0]) : null;
    return res.status(201).json(newZone);
  } catch (error: any) {
    console.error("createDeliveryZone error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ── 4. UPDATE DELIVERY ZONE (Admin) ──
export const updateDeliveryZone = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "Invalid zone ID" });

    const { name, pincodes, charge, minOrderFreeDelivery, estimatedDays, isActive } = req.body;

    // Build dynamic SET clause using raw pg client
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push(`name = $${updates.length + 1}`); values.push(name); }
    if (pincodes !== undefined) {
      const norm = String(pincodes).split(",").map((p) => p.trim()).filter(Boolean).join(",");
      updates.push(`pincodes = $${updates.length + 1}`); values.push(norm);
    }
    if (charge !== undefined) { updates.push(`charge = $${updates.length + 1}`); values.push(parseFloat(String(charge))); }
    if (minOrderFreeDelivery !== undefined) { updates.push(`min_order_free_delivery = $${updates.length + 1}`); values.push(parseFloat(String(minOrderFreeDelivery))); }
    if (estimatedDays !== undefined) { updates.push(`estimated_days = $${updates.length + 1}`); values.push(formatEstimatedDays(estimatedDays)); }
    if (isActive !== undefined) { updates.push(`is_active = $${updates.length + 1}`); values.push(Boolean(isActive)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    values.push(id);
    const setClause = updates.join(", ");
    const rawQuery = `UPDATE delivery_zones SET ${setClause} WHERE id = $${values.length} RETURNING *`;

    const pool = await getPgPool();
    const pgResult = await pool.query(rawQuery, values);
    const rows = pgResult.rows || [];

    if (!rows[0]) return res.status(404).json({ error: "Delivery zone not found." });

    return res.status(200).json(mapZone(rows[0]));
  } catch (error: any) {
    console.error("updateDeliveryZone error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ── 5. DELETE DELIVERY ZONE (Admin) ──
export const deleteDeliveryZone = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "Invalid zone ID" });

    const result = await db.execute(sql`
      DELETE FROM delivery_zones WHERE id = ${id} RETURNING id, name
    `);
    const rows = result.rows || result as any[];

    if (!rows[0]) return res.status(404).json({ error: "Delivery zone not found." });

    return res.status(200).json({ message: "Delivery zone deleted successfully.", id: rows[0].id });
  } catch (error: any) {
    console.error("deleteDeliveryZone error:", error);
    return res.status(500).json({ error: error.message });
  }
};
