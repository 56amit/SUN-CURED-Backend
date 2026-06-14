import "dotenv/config";
import db from "./src/db/config/db.connect";
import { productsTable } from "./src/db/schema/productSchema";
import { sql } from "drizzle-orm";

async function fixNaNPrices() {
  console.log("Fixing NaN prices...");
  
  try {
    await db.update(productsTable)
      .set({ price: 199 }) // Default to 199 for corrupted
      .where(sql`${productsTable.price} = 'NaN'`);
      
    console.log("Fixed successfully!");
  } catch (error) {
    console.error("Error fixing DB:", error);
  }
  process.exit(0);
}

fixNaNPrices();
