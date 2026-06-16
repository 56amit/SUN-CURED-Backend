import { Router } from "express";
import {
  createOrder,
  getOrders,
  getMyOrders,
  updateOrderStatus,
} from "../controllers/order.controller";
import { verifyAdmin } from "../middleware/auth.middleware";

const router: Router = Router();

// Public route: Cart checkout ke waqt order place karne ke liye
router.post("/", createOrder);

// User-only route: Fetch own orders
router.get("/my-orders", verifyAdmin, getMyOrders);

// Admin-only routes: Orders history dekhne aur order update karne ke liye
router.post("/create", verifyAdmin, createOrder);
router.get("/", verifyAdmin, getOrders);
router.put("/:id", verifyAdmin, updateOrderStatus);

export default router;
