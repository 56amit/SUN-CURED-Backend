import { Request, Response } from "express";
import db from "../db/config/db.connect";
import {
  productsTable,
  categoriesTable,
  taxesTable,
} from "../db/schema/productSchema";
import { eq, and } from "drizzle-orm";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.config";

// 1. GET ALL PRODUCTS (supports category filter)
export const getProducts = async (req: Request, res: Response) => {
  try {
    const catIdQuery = req.query.catId
      ? parseInt(req.query.catId as string)
      : null;

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
    const { name, catId, taxId, desc, price, weight, status } = req.body;
    let img = req.body.img || null;

    // Compulsory fields check kar rahe hain
    if (!name || !catId || price === undefined) {
      return res
        .status(400)
        .json({ error: "Name, catId aur price required hain." });
    }

    if (req.file) {
      img = await uploadToCloudinary(req.file.buffer);
    }

    // Check 1: Kya product ki category database me exist karti hai?
    const [catExists] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, parseInt(catId)))
      .limit(1);

    if (!catExists) {
      return res
        .status(400)
        .json({ error: "Select ki gayi category database me nahi mili." });
    }

    // Check 2: Agar manual taxId bheja hai, to kya wo exist karta hai?
    if (taxId) {
      const [taxExists] = await db
        .select()
        .from(taxesTable)
        .where(eq(taxesTable.id, parseInt(taxId)))
        .limit(1);

      if (!taxExists) {
        return res
          .status(400)
          .json({ error: "Select kiya gaya tax slab database me nahi mila." });
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
        price: parseFloat(String(price).replace(/[^\d.]/g, "")),
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
    const id = parseInt(String(req.params.id));
    const { name, catId, taxId, desc, price, weight, status } = req.body;
    const shouldRemoveImage =
      req.body.removeImage === true || req.body.removeImage === "true";

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }

    const [existingProduct] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1);

    if (!existingProduct) {
      return res.status(404).json({ error: "Product nahi mila." });
    }

    let img = existingProduct.img;

    if (req.file) {
      img = await uploadToCloudinary(req.file.buffer);
    } else if (shouldRemoveImage) {
      if (existingProduct.img) {
        await deleteFromCloudinary(existingProduct.img);
      }
      img = null;
    }

    // Check: Agar category update ki ja rahi hai, to kya wo exist karti hai?
    if (catId !== undefined) {
      const [catExists] = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, parseInt(catId)))
        .limit(1);

      if (!catExists) {
        return res
          .status(400)
          .json({ error: "Select ki gayi category database me nahi mili." });
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
        return res
          .status(400)
          .json({ error: "Select kiya gaya tax slab database me nahi mila." });
      }
    }

    const updateData: Record<string, any> = {};

    if (name !== undefined) updateData.name = name;
    if (catId !== undefined) updateData.catId = parseInt(catId);
    if (taxId !== undefined) updateData.taxId = taxId ? parseInt(taxId) : null;
    if (desc !== undefined) updateData.desc = desc;
    if (price !== undefined)
      updateData.price = parseFloat(String(price).replace(/[^\d.]/g, ""));
    if (weight !== undefined) updateData.weight = weight;
    if (req.file || shouldRemoveImage) updateData.img = img;
    if (status !== undefined) updateData.status = status;

    const [updatedProduct] = await db
      .update(productsTable)
      .set(updateData)
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
    const id = parseInt(String(req.params.id));

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }

    const [existingProduct] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1);

    if (!existingProduct) {
      return res.status(404).json({ error: "Product nahi mila." });
    }

    if (existingProduct.img) {
      await deleteFromCloudinary(existingProduct.img);
    }

    const [deletedProduct] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning();

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product nahi mila." });
    }

    return res
      .status(200)
      .json({ message: "Product delete ho gaya.", deletedProduct });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
