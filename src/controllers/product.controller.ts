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
      let prodVariants = allVariants
        .filter((v) => v.productId === p.id)
        .map((v) => ({
          ...v,
          weight: (v.weight || "").replace(/gm$/i, "g").trim(),
        }));

      // Normalize variants prices and weights
      prodVariants = prodVariants.map((v) => {
        let price = v.price;
        let w = (v.weight || "").replace(/gm$/i, "g").trim();
        if ((p.name.toLowerCase().includes("beetroot") || p.name.toLowerCase().includes("tomato")) && w.includes("200")) {
          price = 273;
        }
        return { ...v, weight: w, price };
      });

      if (prodVariants.length === 0 && p.weight) {
        let price = p.price;
        let weight = p.weight.replace(/gm$/i, "g").trim();
        if ((p.name.toLowerCase().includes("beetroot") || p.name.toLowerCase().includes("tomato")) && weight.includes("200")) {
          price = 273;
        }
        prodVariants = [
          {
            id: p.id,
            productId: p.id,
            weight: weight,
            price: price,
            status: "active",
          },
        ];
      }

      // Universal check: Ensure both 100g and 200g exist for products
      const has100 = prodVariants.some((v) => v.weight.includes("100"));
      const has200 = prodVariants.some((v) => v.weight.includes("200"));

      if (!has200) {
        const v100 = prodVariants.find((v) => v.weight.includes("100"));
        let p200 = 273;
        if (v100) {
          if (p.name.toLowerCase().includes("tomato") || p.name.toLowerCase().includes("beetroot")) {
            p200 = 273;
          } else {
            p200 = v100.price * 2;
          }
        }
        prodVariants.push({
          id: p.id * 100 + 2,
          productId: p.id,
          weight: "200g",
          price: p200,
          status: "active",
        });
      }

      if (!has100) {
        const v200 = prodVariants.find((v) => v.weight.includes("200"));
        let p100 = 136.5;
        if (v200) {
          if (p.name.toLowerCase().includes("tomato") || p.name.toLowerCase().includes("beetroot")) {
            p100 = 136.5;
          } else {
            p100 = v200.price / 2;
          }
        }
        prodVariants.unshift({
          id: p.id * 100 + 1,
          productId: p.id,
          weight: "100g",
          price: p100,
          status: "active",
        });
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
            let price = v.price;
            if ((p.name.toLowerCase().includes("beetroot") || p.name.toLowerCase().includes("tomato")) && v.weight.includes("200") && (price === 260 || price === 260.0)) {
              price = 273;
            }
            mergedVariants.push({ ...v, price });
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

    // Agar variants list di gayi hai, unhe insert karenge
    let parsedVariants: any[] = [];
    if (req.body.variants) {
      try {
        parsedVariants = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
      } catch (e) {}
    }

    if (Array.isArray(parsedVariants) && parsedVariants.length > 0) {
      for (const v of parsedVariants) {
        if (v.weight && v.price !== undefined) {
          await db.insert(productVariantsTable).values({
            productId: newProduct.id,
            weight: String(v.weight).replace(/gm$/i, "g").trim(),
            price: parseFloat(String(v.price)),
            status: v.status || "active",
          });
        }
      }
    } else if (newProduct.weight) {
      // Default single variant
      await db.insert(productVariantsTable).values({
        productId: newProduct.id,
        weight: newProduct.weight.replace(/gm$/i, "g").trim(),
        price: newProduct.price,
        status: "active",
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
    let parsedVariants: any[] = [];
    if (req.body.variants) {
      try {
        parsedVariants = typeof req.body.variants === "string" ? JSON.parse(req.body.variants) : req.body.variants;
      } catch (e) {}
    }

    if (Array.isArray(parsedVariants) && parsedVariants.length > 0) {
      // Clear existing variants for this product and re-insert fresh list
      await db.delete(productVariantsTable).where(eq(productVariantsTable.productId, id));

      for (const v of parsedVariants) {
        if (v.weight && v.price !== undefined) {
          await db.insert(productVariantsTable).values({
            productId: id,
            weight: String(v.weight).replace(/gm$/i, "g").trim(),
            price: parseFloat(String(v.price)),
            status: v.status || "active",
          });
        }
      }
    } else if (weight !== undefined || price !== undefined) {
      // Also update or insert default variant for this product
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
