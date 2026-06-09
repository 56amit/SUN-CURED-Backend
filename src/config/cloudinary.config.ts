import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import "dotenv/config";

export const connectCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

// Ye function file buffer ko Cloudinary pe upload karega
export const uploadToCloudinary = (fileBuffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "sun-cured-products" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result!.secure_url); // Upload hone ke baad image URL return karega
      }
    );

    // Buffer ko readable stream me convert karke pipe karenge
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null); 
    stream.pipe(uploadStream);
  });
};
