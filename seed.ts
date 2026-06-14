import "dotenv/config";
import db from "./src/db/config/db.connect";
import { categoriesTable, productsTable } from "./src/db/schema/productSchema";

async function seed() {
  console.log("Seeding database...");
  
  try {
    // 1. Insert Categories
    const categories = await db.insert(categoriesTable).values([
      { name: "Chips & Snacks", status: "active" },
      { name: "Premixes", status: "active" },
      { name: "Powders", status: "active" }
    ]).returning();
    
    console.log("Categories seeded:", categories.length);

    // 2. Insert Products
    await db.insert(productsTable).values([
      {
        name: "Beetroot Chips",
        catId: categories[0].id,
        desc: "Solar-dried beetroot crisps — rich in iron, antioxidants & natural colour.",
        price: 199,
        weight: "150g",
        img: "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?q=80&w=800&auto=format&fit=crop",
        status: "active"
      },
      {
        name: "Dried Mango Slices",
        catId: categories[0].id,
        desc: "Sweet, chewy sun-dried mango — no added sugar.",
        price: 179,
        weight: "100g",
        img: "https://images.unsplash.com/photo-1628557044797-f21a177c37ec?q=80&w=600&auto=format&fit=crop",
        status: "active"
      },
      {
        name: "Beetroot Aam Panna Premix",
        catId: categories[1].id,
        desc: "Traditional Aam Panna with the power of Beetroot. No sugar, no chemicals.",
        price: 249,
        weight: "200g",
        img: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=600&auto=format&fit=crop",
        status: "active"
      },
      {
        name: "Solar Dried Garlic Powder",
        catId: categories[2].id,
        desc: "Pure, additive-free garlic powder — intense flavour, immunity-boosting.",
        price: 129,
        weight: "100g",
        img: "https://images.unsplash.com/photo-1615485925600-97237c4fc1ec?q=80&w=600&auto=format&fit=crop",
        status: "active"
      }
    ]);

    console.log("Products seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
  process.exit(0);
}

seed();
