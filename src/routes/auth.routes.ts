import { Router } from "express";
import { login, register, getMe } from "../controllers/auth.controller";

const router: Router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", getMe);

export default router;
