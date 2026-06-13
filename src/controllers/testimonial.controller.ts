import { Request, Response } from "express";
import db from "../db/config/db.connect";
import { testimonialsTable } from "../db/schema/testimonialSchema";
import { usersTable } from "../db/schema/userSchema";
import { eq, desc } from "drizzle-orm";

// 1. Submit Testimonial (Frontend - Customer)
export const submitTestimonial = async (req: Request, res: Response) => {
  try {
    const { userId, rating, content } = req.body;

    if (!userId || !rating || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [newTestimonial] = await db.insert(testimonialsTable).values({
      userId,
      rating,
      content,
      status: "pending"
    }).returning();

    return res.status(201).json({ message: "Testimonial submitted successfully, awaiting approval.", testimonial: newTestimonial });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Get Approved Testimonials (Frontend - Public)
export const getApprovedTestimonials = async (req: Request, res: Response) => {
  try {
    const testimonials = await db
      .select({
        id: testimonialsTable.id,
        rating: testimonialsTable.rating,
        content: testimonialsTable.content,
        createdAt: testimonialsTable.createdAt,
        user: {
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        }
      })
      .from(testimonialsTable)
      .leftJoin(usersTable, eq(testimonialsTable.userId, usersTable.id))
      .where(eq(testimonialsTable.status, "approved"))
      .orderBy(desc(testimonialsTable.createdAt));

    return res.status(200).json(testimonials);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. Get All Testimonials (Admin)
export const getAllTestimonials = async (req: Request, res: Response) => {
  try {
    const testimonials = await db
      .select({
        id: testimonialsTable.id,
        rating: testimonialsTable.rating,
        content: testimonialsTable.content,
        status: testimonialsTable.status,
        createdAt: testimonialsTable.createdAt,
        user: {
          id: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          email: usersTable.email
        }
      })
      .from(testimonialsTable)
      .leftJoin(usersTable, eq(testimonialsTable.userId, usersTable.id))
      .orderBy(desc(testimonialsTable.createdAt));

    return res.status(200).json(testimonials);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. Update Testimonial Status (Admin)
export const updateTestimonialStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, content } = req.body;

    const [updated] = await db.update(testimonialsTable)
      .set({ status, content })
      .where(eq(testimonialsTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Testimonial not found" });
    }

    return res.status(200).json({ message: "Testimonial updated", testimonial: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 5. Delete Testimonial (Admin)
export const deleteTestimonial = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [deleted] = await db.delete(testimonialsTable)
      .where(eq(testimonialsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Testimonial not found" });
    }

    return res.status(200).json({ message: "Testimonial deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
