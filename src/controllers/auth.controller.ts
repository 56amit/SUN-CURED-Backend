import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "../db/config/db.connect";
import { usersTable } from "../db/schema/userSchema";
import { eq } from "drizzle-orm";
import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET || "default_secret_key";

// 1. Register new customer
export const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [newUser] = await db.insert(usersTable).values({
      firstName,
      lastName,
      email,
      passwordHash,
      phone,
      role: "customer"
    }).returning();

    const token = jwt.sign({ id: newUser.id, role: newUser.role }, jwtSecret, { expiresIn: "7d" });

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: { id: newUser.id, firstName: newUser.firstName, lastName: newUser.lastName, email: newUser.email, role: newUser.role }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Login (Admin OR Customer)
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body; // we also accept 'username' for legacy admin support
    const username = req.body.username || email;

    if (!username || !password) {
      return res.status(400).json({ error: "Email/Username and Password required" });
    }

    // Check Hardcoded Admin
    const envUsername = process.env.ADMIN_USERNAME || "admin";
    const envPassword = process.env.ADMIN_PASSWORD || "admin123";
    
    if (username === envUsername && password === envPassword) {
      const token = jwt.sign({ id: "admin", role: "admin" }, jwtSecret, { expiresIn: "24h" });
      return res.status(200).json({ message: "Admin login successful", token, user: { id: "admin", role: "admin", firstName: "Admin" } });
    }

    // Check DB User
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, username));
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. Get Me
export const getMe = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, jwtSecret);

    if (decoded.role === "admin") {
      return res.status(200).json({ user: { id: "admin", role: "admin", firstName: "Admin" } });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.id));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, phone: user.phone }
    });
  } catch (error: any) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
