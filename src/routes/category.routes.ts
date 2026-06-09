import { Router } from "express";
import { getCategories, createCategory, updateCategory, deleteCategory } from "../controllers/category.controller";
import { verifyAdmin } from "../middleware/auth.middleware";

const router: Router = Router();

// Public route: Categories ko koi bhi list kar sakta hai
router.get("/", getCategories);

// Admin-only routes: Protected with verifyAdmin
router.post("/", verifyAdmin, createCategory);
router.put("/:id", verifyAdmin, updateCategory);
router.delete("/:id", verifyAdmin, deleteCategory);

export default router;
