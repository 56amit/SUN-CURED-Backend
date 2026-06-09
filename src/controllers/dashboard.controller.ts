import { Request, Response } from "express";
import db from "../db/config/db.connect";
import { productsTable, categoriesTable, taxesTable } from "../db/schema/productSchema";
import { count, eq, desc, sql } from "drizzle-orm";

// Dashboard stats generate karne ke liye controller
export const getStats = async (req: Request, res: Response) => {
  try {
    // 1. Total products count nikalo
    const prodCountRes = await db.select({ count: count() }).from(productsTable);
    const totalProducts = prodCountRes[0]?.count || 0;

    // 2. Active categories count nikalo
    const catCountRes = await db
      .select({ count: count() })
      .from(categoriesTable)
      .where(eq(categoriesTable.status, "active"));
    const activeCategories = catCountRes[0]?.count || 0;

    // 3. Active taxes count nikalo
    const taxCountRes = await db
      .select({ count: count() })
      .from(taxesTable)
      .where(eq(taxesTable.status, "active"));
    const activeTaxes = taxCountRes[0]?.count || 0;

    // 4. Avg price nikalo (COALESCE use kiya hai taaki agar product na ho to ₹0 aaye)
    const avgPriceRes = await db
      .select({ avgPrice: sql<number>`COALESCE(round(avg(${productsTable.price})), 0)` })
      .from(productsTable);
    const avgPrice = avgPriceRes[0]?.avgPrice || 0;

    // 5. Recent 8 products fetch karo
    const recentProducts = await db
      .select()
      .from(productsTable)
      .orderBy(desc(productsTable.id))
      .limit(8);

    return res.status(200).json({
      totalProducts,
      activeCategories,
      activeTaxes,
      avgPrice,
      recentProducts,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
