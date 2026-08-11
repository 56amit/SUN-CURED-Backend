import { Router } from "express";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";
import { verifyAdmin } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router: Router = Router();

// Public route: Products to customer UI pe dikhane hain (sab dekh sakte hain)
router.get("/", getProducts);

// Admin-only routes: Protected routes
router.post("/", verifyAdmin, upload.single("image"), createProduct);
router.put("/:id", verifyAdmin, upload.single("image"), updateProduct);
router.delete("/:id", verifyAdmin, deleteProduct);

export default router;
