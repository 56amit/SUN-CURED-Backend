import { Router } from "express";
import { getProducts, createProduct, updateProduct, deleteProduct } from "../controllers/product.controller";
import { verifyAdmin } from "../middleware/auth.middleware";

const router = Router();

// Public route: Products to customer UI pe dikhane hain (sab dekh sakte hain)
router.get("/", getProducts);

// Admin-only routes: Protected routes
router.post("/", verifyAdmin, createProduct);
router.put("/:id", verifyAdmin, updateProduct);
router.delete("/:id", verifyAdmin, deleteProduct);

export default router;
