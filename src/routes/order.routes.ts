import { Router } from "express";
import {
  createOrder,
  getOrders,
  getMyOrders,
  updateOrderStatus,
  getOrderItems,
  getOrderById,
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
router.get("/:id", verifyAdmin, getOrderById);
router.put("/:id", verifyAdmin, updateOrderStatus);
router.put("/:id/status", verifyAdmin, updateOrderStatus);
router.get("/:id/items", verifyAdmin, getOrderItems);

export default router;
