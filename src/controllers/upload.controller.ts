import { Request, Response } from "express";
import { uploadToCloudinary } from "../config/cloudinary.config";
import { v2 as cloudinary } from "cloudinary";

// Ye controller dono scenarios handle karega: raw file upload aur base64 text upload
export const uploadImage = async (req: Request, res: Response) => {
  try {
    // Scenario A: Raw image upload hui ho (via Multer middleware)
    if (req.file) {
      // Memory buffer ko Cloudinary pe stream karenge
      const imageUrl = await uploadToCloudinary(req.file.buffer);
      return res.status(200).json({ imageUrl });
    }

    // Scenario B: Frontend ne image ko base64 data URL me convert karke body me bheja ho
    const { imageBase64 } = req.body;
    if (imageBase64) {
      // Cloudinary base64 text direct accept karta hai upload method ke sath
      const uploadResult = await cloudinary.uploader.upload(imageBase64, {
        folder: "sun-cured-products",
      });
      return res.status(200).json({ imageUrl: uploadResult.secure_url });
    }

    return res.status(400).json({ error: "Koi image file ya base64 string nahi mili." });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
