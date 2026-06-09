import db from "../src/db/config/db.connect";
import { taxesTable, categoriesTable, productsTable } from "../src/db/schema";

// Database tables validation check karne ke liye script
async function verifyDatabase() {
  console.log("Testing Drizzle connections and tables query...");
  try {
    const taxes = await db.select().from(taxesTable).limit(1);
    console.log("Taxes table query test passed! Found count:", taxes.length);

    const cats = await db.select().from(categoriesTable).limit(1);
    console.log("Categories table query test passed! Found count:", cats.length);

    const products = await db.select().from(productsTable).limit(1);
    console.log("Products table query test passed! Found count:", products.length);

    console.log("🎉 Database schema verification completed successfully!");
  } catch (error) {
    console.error("❌ Database query verification failed:", error);
  }
}

verifyDatabase();
