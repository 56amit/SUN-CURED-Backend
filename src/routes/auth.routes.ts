import { Router } from "express";
import { login, register, getMe, googleLogin } from "../controllers/auth.controller";

const router: Router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", getMe);

export default router;
