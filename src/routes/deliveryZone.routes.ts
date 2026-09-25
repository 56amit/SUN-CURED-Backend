import { Router } from "express";
import {
  getDeliveryZones,
  checkPincode,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
} from "../controllers/deliveryZone.controller";
import { verifyAdmin } from "../middleware/auth.middleware";

const router: Router = Router();

// Public routes (frontend checkout use karega)
router.get("/", getDeliveryZones);
router.get("/check", checkPincode);  // ?pincode=122052&subtotal=350

// Admin-only routes
router.post("/", verifyAdmin, createDeliveryZone);
router.put("/:id", verifyAdmin, updateDeliveryZone);
router.delete("/:id", verifyAdmin, deleteDeliveryZone);

export default router;
