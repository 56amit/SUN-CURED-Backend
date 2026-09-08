import db from "../src/db/config/db.connect";
import { sql } from "drizzle-orm";
import { productsTable, productVariantsTable } from "../src/db/schema/productSchema";
import { eq } from "drizzle-orm";

async function runMigration() {
  console.log("Starting Product Variants migration...");

  // 1. Create table if not exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS product_variants (
      id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      weight VARCHAR(50) NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      status VARCHAR(50) DEFAULT 'active' NOT NULL
    );
  `);

  // Add variant_id column to order_items if not exists
  await db.execute(sql`
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INT REFERENCES product_variants(id) ON DELETE SET NULL;
  `);

  console.log("Database tables verified/created.");

  // 2. Fetch all products
  const allProducts = await db.select().from(productsTable);
  console.log(`Found ${allProducts.length} total product rows in DB.`);

  // Group products by normalized name (lowercase trimmed)
  const groupedMap = new Map<string, typeof allProducts>();
  for (const p of allProducts) {
    const key = p.name.trim().toLowerCase();
    const existing = groupedMap.get(key) || [];
    existing.push(p);
    groupedMap.set(key, existing);
  }

  console.log(`Grouped into ${groupedMap.size} unique product titles.`);

  for (const [key, prodRows] of groupedMap.entries()) {
    // Keep the first product as parent
    const parent = prodRows[0];

    // For each row in this group, create a variant if it doesn't already exist for parent
    for (const row of prodRows) {
      let weight = (row.weight || "100g").trim();
      let price = row.price;

      // Fix Beetroot powder 200g price if it's 260
      if (parent.name.toLowerCase().includes("beetroot") && weight.toLowerCase().includes("200")) {
        if (price === 260) {
          price = 273;
          console.log(`Corrected ${parent.name} (${weight}) price from 260 -> 273`);
        }
      }

      // Check if variant already exists
      const existingVariants = await db
        .select()
        .from(productVariantsTable)
        .where(eq(productVariantsTable.productId, parent.id));

      const alreadyExists = existingVariants.some(
        (v) => v.weight.toLowerCase() === weight.toLowerCase()
      );

      if (!alreadyExists) {
        await db.insert(productVariantsTable).values({
          productId: parent.id,
          weight: weight,
          price: price,
          status: "active",
        });
        console.log(`Inserted variant: ${parent.name} - ${weight} @ ₹${price}`);
      }

      // If this row is a duplicate parent row (different ID than parent.id), clean up duplicate parent product rows
      if (row.id !== parent.id) {
        // Re-link any order items referencing row.id to parent.id first before deleting duplicate
        await db.execute(sql`UPDATE order_items SET product_id = ${parent.id} WHERE product_id = ${row.id}`);
        await db.delete(productsTable).where(eq(productsTable.id, row.id));
        console.log(`Removed duplicate product row ID ${row.id}`);
      }
    }
  }

  console.log("Migration finished successfully!");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
