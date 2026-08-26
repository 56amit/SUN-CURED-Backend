import { Router } from "express";
import { initiatePayment } from "../controllers/payment.controller";

const router: Router = Router();

router.post("/initiate", initiatePayment);

export default router;
