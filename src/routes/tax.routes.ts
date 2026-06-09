import { Router } from "express";
import { getTaxes, createTax, updateTax, deleteTax } from "../controllers/tax.controller";
import { verifyAdmin } from "../middleware/auth.middleware";

const router: Router = Router();

// Sabhi log taxes list dekh sakte hain (public route)
router.get("/", getTaxes);

// Naya tax add karne, edit karne aur delete karne ke liye Admin verified hona chahiye (protected routes)
router.post("/", verifyAdmin, createTax);
router.put("/:id", verifyAdmin, updateTax);
router.delete("/:id", verifyAdmin, deleteTax);

export default router;
