import { Router } from "express";
import { getStats } from "../controllers/dashboard.controller";

const router = Router();

// GET /api/dashboard/stats -> Admin home ke widgets ke liye statistics data fetch karega
router.get("/stats", getStats);

export default router;
