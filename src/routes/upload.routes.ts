import { Router } from "express";
import { uploadImage } from "../controllers/upload.controller";
import { upload } from "../middleware/upload.middleware";
import { verifyAdmin } from "../middleware/auth.middleware";

const router: Router = Router();

// POST /api/upload -> Pehle admin verify hoga, fir multer image file read karega, fir upload controller run hoga
router.post("/", verifyAdmin, upload.single("image"), uploadImage);

export default router;
