import { Router } from "express";
import {
  submitTestimonial,
  getApprovedTestimonials,
  getAllTestimonials,
  updateTestimonialStatus,
  deleteTestimonial,
} from "../controllers/testimonial.controller";

const router: Router = Router();

// Public / Customer Endpoints
router.post("/", submitTestimonial);
router.get("/approved", getApprovedTestimonials);

// Admin / General Endpoints (Supports both GET / and GET /admin)
router.get("/", getAllTestimonials);
router.get("/admin", getAllTestimonials);

// Update Status (Supports both PUT /:id and PUT /admin/:id)
router.put("/:id", updateTestimonialStatus);
router.put("/admin/:id", updateTestimonialStatus);

// Delete (Supports both DELETE /:id and DELETE /admin/:id)
router.delete("/:id", deleteTestimonial);
router.delete("/admin/:id", deleteTestimonial);

export default router;
