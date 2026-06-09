import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";

// Admin Login Handler
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username aur Password dono required hain." });
    }

    const envUsername = process.env.ADMIN_USERNAME || "admin";
    const envPassword = process.env.ADMIN_PASSWORD || "admin123";
    const jwtSecret = process.env.JWT_SECRET || "default_secret_key";

    // Credentials verify kar rahe hain
    if (username !== envUsername || password !== envPassword) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Token generate kar rahe hain (Expires in 24 hours)
    const token = jwt.sign({ id: "admin" }, jwtSecret, { expiresIn: "24h" });

    return res.status(200).json({
      message: "Login successful!",
      token,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
