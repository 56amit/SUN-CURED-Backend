import { Router } from "express";
import { login } from "../controllers/auth.controller";

const router = Router();

// POST /api/auth/login -> Username aur password lekar JWT Token return karega
router.post("/login", login);

export default router;
