import { Router } from "express";
import { initiatePayment, verifyPayment } from "../controllers/payment.controller";

const router: Router = Router();

router.post("/initiate", initiatePayment);
router.post("/verify", verifyPayment);

export default router;
