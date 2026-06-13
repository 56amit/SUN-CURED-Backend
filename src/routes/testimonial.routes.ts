import { Router } from "express";
import { 
  submitTestimonial, 
  getApprovedTestimonials, 
  getAllTestimonials, 
  updateTestimonialStatus, 
  deleteTestimonial 
} from "../controllers/testimonial.controller";

const router = Router();

// Public / Customer Endpoints
router.post("/", submitTestimonial);
router.get("/", getApprovedTestimonials);

// Admin Endpoints
router.get("/admin", getAllTestimonials);
router.put("/admin/:id", updateTestimonialStatus);
router.delete("/admin/:id", deleteTestimonial);

export default router;
