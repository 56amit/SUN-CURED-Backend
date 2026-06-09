import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

// Request object ko extend kar rahe hain taaki admin ki details add kar sakein
export interface AuthRequest extends Request {
  adminId?: string;
}

// Ye middleware check karega ki request authorization token ke sath aayi hai ya nahi
export const verifyAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. Token missing hai." });
  }

  const token = authHeader.split(" ")[1].trim().replace(/\s+/g, "");

  try {
    // Token verify kar rahe hain secret key ke sath
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret_key") as { id: string };
    req.adminId = decoded.id;
    next(); // Agar token sahi hai, to request next function pe chali jayegi
  } catch (error) {
    return res.status(401).json({ error: "Access denied. Invalid token." });
  }
};
