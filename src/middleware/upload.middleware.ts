import multer from "multer";

// Memory storage configure kar rahe hain taaki image direct RAM/Buffer me aaye (no disk write)
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5MB file size allowed
  },
});
