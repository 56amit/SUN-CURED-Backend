import { Request, Response } from "express";
import db from "../db/config/db.connect";
import { categoriesTable, taxesTable } from "../db/schema/productSchema";
import { eq } from "drizzle-orm";

// 1. GET ALL CATEGORIES
export const getCategories = async (req: Request, res: Response) => {
  try {
    const allCategories = await db.select().from(categoriesTable);
    return res.status(200).json(allCategories);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. CREATE NEW CATEGORY
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, taxId, desc, status } = req.body;

    if (!name || !taxId) {
      return res.status(400).json({ error: "Name aur mapped taxId required hain." });
    }

    // Validation check: taxId sach me taxesTable me exist karta hai ya nahi?
    const [taxExists] = await db
      .select()
      .from(taxesTable)
      .where(eq(taxesTable.id, parseInt(taxId)))
      .limit(1);

    if (!taxExists) {
      return res.status(400).json({ error: "Mapped tax ID database me exist nahi karta." });
    }

    // Category insert kar rahe hain database me
    const [newCategory] = await db
      .insert(categoriesTable)
      .values({
        name,
        taxId: parseInt(taxId),
        desc: desc || null,
        status: status || "active",
      })
      .returning();

    return res.status(201).json(newCategory);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. UPDATE EXISTING CATEGORY
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, taxId, desc, status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid category ID." });
    }

    // Agar taxId update ho rahi hai, to validation check karenge
    if (taxId !== undefined) {
      const [taxExists] = await db
        .select()
        .from(taxesTable)
        .where(eq(taxesTable.id, parseInt(taxId)))
        .limit(1);

      if (!taxExists) {
        return res.status(400).json({ error: "Mapped tax ID database me exist nahi karta." });
      }
    }

    const [updatedCategory] = await db
      .update(categoriesTable)
      .set({
        name,
        taxId: taxId !== undefined ? parseInt(taxId) : undefined,
        desc,
        status,
      })
      .where(eq(categoriesTable.id, id))
      .returning();

    if (!updatedCategory) {
      return res.status(404).json({ error: "Category nahi mili." });
    }

    return res.status(200).json(updatedCategory);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. DELETE CATEGORY
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid category ID." });
    }

    const [deletedCategory] = await db
      .delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .returning();

    if (!deletedCategory) {
      return res.status(404).json({ error: "Category nahi mili." });
    }

    return res.status(200).json({ message: "Category delete ho gayi.", deletedCategory });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
