import { Request, Response } from "express";
import db from "../db/config/db.connect";
import {
  productsTable,
  productVariantsTable,
  categoriesTable,
  taxesTable,
} from "../db/schema/productSchema";
import { eq, and, sql } from "drizzle-orm";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.config";

let migrationChecked = false;
async function ensureVariantsTable() {
  if (migrationChecked) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        weight VARCHAR(50) NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        status VARCHAR(50) DEFAULT 'active' NOT NULL
      );
    `);
    migrationChecked = true;
  } catch (err) {
    console.error("ensureVariantsTable error:", err);
  }
}

function parseVariantsInput(rawVariants: any): Array<{ weight: string; price: number; status?: string }> {
  if (!rawVariants) return [];
  let parsed: any = rawVariants;
  if (typeof rawVariants === "string") {
    try {
      let cleaned = rawVariants.replace(/\[\s*\{+/g, "[{").replace(/\}+\s*\]/g, "}]");
      parsed = JSON.parse(cleaned);
    } catch (e) {
      try {
        parsed = JSON.parse(rawVariants);
      } catch (err) {}
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      weight: String(item.weight || "").replace(/gm$/i, "g").trim(),
      price: parseFloat(String(item.price).replace(/[^\d.]/g, "")),
      status: item.status || "active",
    }))
    .filter((v) => v.weight && !isNaN(v.price));
}

// 1. GET ALL PRODUCTS (supports category filter)
export const getProducts = async (req: Request, res: Response) => {
  try {
    await ensureVariantsTable();

    const catIdQuery = req.query.catId
      ? parseInt(req.query.catId as string)
      : null;

    let allProducts;
    if (catIdQuery && !isNaN(catIdQuery)) {
      allProducts = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.catId, catIdQuery));
    } else {
      allProducts = await db.select().from(productsTable);
    }

    let allVariants: any[] = [];
    try {
      allVariants = await db.select().from(productVariantsTable);
    } catch (variantErr) {
      console.warn("Could not fetch product_variants, falling back:", variantErr);
    }

    // Group products by clean name key so client receives 1 product object with variants
    const groupedMap = new Map<string, any>();

    for (const p of allProducts) {
      const nameKey = p.name.trim().toLowerCase();

      // Only use variants stored in DB — normalize weight format
      let prodVariants = allVariants
        .filter((v) => v.productId === p.id)
        .map((v) => ({
          ...v,
          weight: (v.weight || "").replace(/gm$/i, "g").trim(),
        }));

      // Fallback: if no variants in DB at all, use the product's own weight/price
      if (prodVariants.length === 0 && p.weight) {
        prodVariants = [
          {
            id: p.id,
            productId: p.id,
            weight: p.weight.replace(/gm$/i, "g").trim(),
            price: p.price,
            status: "active",
          },
        ];
      }

      prodVariants.sort((a, b) => a.price - b.price);

      if (!groupedMap.has(nameKey)) {
        groupedMap.set(nameKey, {
          ...p,
          weight: p.weight ? p.weight.replace(/gm$/i, "g").trim() : p.weight,
          variants: [...prodVariants],
        });
      } else {
        const existing = groupedMap.get(nameKey);
        const mergedVariants = [...existing.variants];
        for (const v of prodVariants) {
          if (!mergedVariants.some((mv) => mv.weight.toLowerCase() === v.weight.toLowerCase())) {
            mergedVariants.push(v);
          }
        }
        mergedVariants.sort((a, b) => a.price - b.price);
        existing.variants = mergedVariants;
      }
    }

    const productsResult = Array.from(groupedMap.values());
    return res.status(200).json(productsResult);
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
        weight: weight ? weight.replace(/gm$/i, "g").trim() : null,
        img: img || null,
        status: status || "active",
      })
      .returning();

    // Merge base product weight/price and any extra variants provided in body
    const baseWeight = newProduct.weight ? newProduct.weight.replace(/gm$/i, "g").trim() : null;
    const basePrice = newProduct.price;

    const parsedVariants = parseVariantsInput(req.body.variants);
    const variantsToInsert: Array<{ weight: string; price: number; status: string }> = [];

    if (baseWeight && basePrice !== undefined && !isNaN(basePrice)) {
      variantsToInsert.push({
        weight: baseWeight,
        price: basePrice,
        status: "active",
      });
    }

    for (const v of parsedVariants) {
      if (!variantsToInsert.some((existing) => existing.weight.toLowerCase() === v.weight.toLowerCase())) {
        variantsToInsert.push({
          weight: v.weight,
          price: v.price,
          status: v.status || "active",
        });
      }
    }

    for (const v of variantsToInsert) {
      await db.insert(productVariantsTable).values({
        productId: newProduct.id,
        weight: v.weight,
        price: v.price,
        status: v.status,
      });
    }

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
    if (weight !== undefined) updateData.weight = String(weight).replace(/gm$/i, "g").trim();
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

    // Variants update / sync
    const parsedVariants = parseVariantsInput(req.body.variants);

    if (parsedVariants.length > 0) {
      const updatedWeight = updatedProduct.weight ? updatedProduct.weight.replace(/gm$/i, "g").trim() : null;
      const updatedPrice = updatedProduct.price;

      const finalVariants: Array<{ weight: string; price: number; status: string }> = [];

      if (updatedWeight && updatedPrice !== undefined && !isNaN(updatedPrice)) {
        finalVariants.push({
          weight: updatedWeight,
          price: updatedPrice,
          status: "active",
        });
      }

      for (const v of parsedVariants) {
        if (!finalVariants.some((existing) => existing.weight.toLowerCase() === v.weight.toLowerCase())) {
          finalVariants.push({
            weight: v.weight,
            price: v.price,
            status: v.status || "active",
          });
        }
      }

      await db.delete(productVariantsTable).where(eq(productVariantsTable.productId, id));

      const insertedVariants: any[] = [];
      for (const v of finalVariants) {
        const [newV] = await db
          .insert(productVariantsTable)
          .values({
            productId: id,
            weight: v.weight,
            price: v.price,
            status: v.status,
          })
          .returning();
        insertedVariants.push(newV);
      }

      return res.status(200).json({
        ...updatedProduct,
        variants: insertedVariants,
      });
    } else if (weight !== undefined || price !== undefined) {
      const existingVariants = await db
        .select()
        .from(productVariantsTable)
        .where(eq(productVariantsTable.productId, id));

      if (existingVariants.length === 1) {
        const vUpdate: Record<string, any> = {};
        if (weight !== undefined) vUpdate.weight = String(weight).replace(/gm$/i, "g").trim();
        if (price !== undefined) vUpdate.price = parseFloat(String(price).replace(/[^\d.]/g, ""));
        await db.update(productVariantsTable).set(vUpdate).where(eq(productVariantsTable.id, existingVariants[0].id));
      }
    }

    const currentVariants = await db
      .select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, id));

    return res.status(200).json({
      ...updatedProduct,
      variants: currentVariants,
    });
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
