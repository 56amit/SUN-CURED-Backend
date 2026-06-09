import { Request, Response } from "express";
import db from "../db/config/db.connect";
import { taxesTable } from "../db/schema/productSchema";
import { eq } from "drizzle-orm";

// 1. GET ALL TAX SLABS
export const getTaxes = async (req: Request, res: Response) => {
  try {
    // Database se saare taxes fetch kar rahe hain
    const allTaxes = await db.select().from(taxesTable);
    return res.status(200).json(allTaxes);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. CREATE NEW TAX SLAB
export const createTax = async (req: Request, res: Response) => {
  try {
    const { name, rate, desc, status } = req.body;

    if (!name || rate === undefined) {
      return res.status(400).json({ error: "Name aur Rate required hain." });
    }

    // Database me naya row insert kar rahe hain
    const [newTax] = await db
      .insert(taxesTable)
      .values({
        name,
        rate: parseFloat(rate),
        desc: desc || null,
        status: status || "active",
      })
      .returning(); // .returning() se insert hui row wapas milti hai

    return res.status(201).json(newTax);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. UPDATE EXISTING TAX SLAB
export const updateTax = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { name, rate, desc, status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid tax ID." });
    }

    // Database me record update kar rahe hain where id match karti ho
    const [updatedTax] = await db
      .update(taxesTable)
      .set({
        name,
        rate: rate !== undefined ? parseFloat(rate) : undefined,
        desc,
        status,
      })
      .where(eq(taxesTable.id, id))
      .returning();

    if (!updatedTax) {
      return res.status(404).json({ error: "Tax slab nahi mila." });
    }

    return res.status(200).json(updatedTax);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. DELETE TAX SLAB
export const deleteTax = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid tax ID." });
    }

    // Database se delete kar rahe hain where id matches
    const [deletedTax] = await db
      .delete(taxesTable)
      .where(eq(taxesTable.id, id))
      .returning();

    if (!deletedTax) {
      return res.status(404).json({ error: "Tax slab nahi mila." });
    }

    return res
      .status(200)
      .json({ message: "Tax slab delete ho gaya.", deletedTax });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
