import { Request, Response } from "express";
import db from "../db/config/db.connect";
import { productsTable, categoriesTable, taxesTable } from "../db/schema/productSchema";
import { eq, and } from "drizzle-orm";

// 1. GET ALL PRODUCTS (supports category filter)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const catIdQuery = req.query.catId ? parseInt(req.query.catId as string) : null;

    let allProducts;
    if (catIdQuery && !isNaN(catIdQuery)) {
      // Agar client ne specific category filter manga hai
      allProducts = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.catId, catIdQuery));
    } else {
      // Default: saare products fetch karenge
      allProducts = await db.select().from(productsTable);
    }

    return res.status(200).json(allProducts);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. CREATE NEW PRODUCT
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, catId, taxId, desc, price, weight, img, status } = req.body;

    // Compulsory fields check kar rahe hain
    if (!name || !catId || price === undefined) {
      return res.status(400).json({ error: "Name, catId aur price required hain." });
    }

    // Check 1: Kya product ki category database me exist karti hai?
    const [catExists] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, parseInt(catId)))
      .limit(1);

    if (!catExists) {
      return res.status(400).json({ error: "Select ki gayi category database me nahi mili." });
    }

    // Check 2: Agar manual taxId bheja hai, to kya wo exist karta hai?
    if (taxId) {
      const [taxExists] = await db
        .select()
        .from(taxesTable)
        .where(eq(taxesTable.id, parseInt(taxId)))
        .limit(1);

      if (!taxExists) {
        return res.status(400).json({ error: "Select kiya gaya tax slab database me nahi mila." });
      }
    }

    // Product insert kar rahe hain database me
    const [newProduct] = await db
      .insert(productsTable)
      .values({
        name,
        catId: parseInt(catId),
        taxId: taxId ? parseInt(taxId) : null,
        desc: desc || null,
        price: parseFloat(price),
        weight: weight || null,
        img: img || null,
        status: status || "active",
      })
      .returning();

    return res.status(201).json(newProduct);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. UPDATE EXISTING PRODUCT
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, catId, taxId, desc, price, weight, img, status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }

    // Check: Agar category update ki ja rahi hai, to kya wo exist karti hai?
    if (catId !== undefined) {
      const [catExists] = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, parseInt(catId)))
        .limit(1);

      if (!catExists) {
        return res.status(400).json({ error: "Select ki gayi category database me nahi mili." });
      }
    }

    // Check: Agar taxId update ki ja rahi hai, to kya wo exist karti hai?
    if (taxId !== undefined && taxId !== null) {
      const [taxExists] = await db
        .select()
        .from(taxesTable)
        .where(eq(taxesTable.id, parseInt(taxId)))
        .limit(1);

      if (!taxExists) {
        return res.status(400).json({ error: "Select kiya gaya tax slab database me nahi mila." });
      }
    }

    // DB update request
    const [updatedProduct] = await db
      .update(productsTable)
      .set({
        name,
        catId: catId !== undefined ? parseInt(catId) : undefined,
        taxId: taxId !== undefined ? (taxId ? parseInt(taxId) : null) : undefined,
        desc,
        price: price !== undefined ? parseFloat(price) : undefined,
        weight,
        img,
        status,
      })
      .where(eq(productsTable.id, id))
      .returning();

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product nahi mila." });
    }

    return res.status(200).json(updatedProduct);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. DELETE PRODUCT
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }

    const [deletedProduct] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning();

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product nahi mila." });
    }

    return res.status(200).json({ message: "Product delete ho gaya.", deletedProduct });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
