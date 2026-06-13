import { Request, Response } from "express";
import db from "../db/config/db.connect";
import { usersTable } from "../db/schema/userSchema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

// 1. Get All Users (Admin)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    // Remove passwordHash from response
    const sanitizedUsers = users.map(u => {
      const { passwordHash, ...safeUser } = u;
      return safeUser;
    });
    return res.status(200).json(sanitizedUsers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Create User Manually (Admin)
export const createUser = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, role, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [newUser] = await db.insert(usersTable).values({
      firstName,
      lastName,
      email,
      phone,
      role: role || "customer",
      passwordHash
    }).returning();

    const { passwordHash: _, ...safeUser } = newUser;
    return res.status(201).json({ message: "User created successfully", user: safeUser });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 3. Update User (Admin)
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { firstName, lastName, phone, isActive, role } = req.body;

    const [updated] = await db.update(usersTable)
      .set({ firstName, lastName, phone, isActive, role, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    const { passwordHash: _, ...safeUser } = updated;
    return res.status(200).json({ message: "User updated successfully", user: safeUser });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// 4. Delete User (Admin)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, userId)).returning();

    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ message: "User deleted successfully", id: deleted.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
