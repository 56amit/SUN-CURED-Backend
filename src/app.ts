import express from "express";
import cors from "cors";
import { connectCloudinary } from "./config/cloudinary.config";

// Routes imports
import authRouter from "./routes/auth.routes";
import taxRouter from "./routes/tax.routes";
import categoryRouter from "./routes/category.routes";
import productRouter from "./routes/product.routes";
import uploadRouter from "./routes/upload.routes";
import dashboardRouter from "./routes/dashboard.routes";
import orderRouter from "./routes/order.routes";
import userRouter from "./routes/user.routes";
import testimonialRouter from "./routes/testimonial.routes";

// Cloudinary connection initialize kar rahe hain
connectCloudinary();

export const app: express.Application = express();

// Standard middlewares ko pehle call karenge taaki incoming request body parse ho sake
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // parses URL-encoded body data

// Basic Home route
app.get("/", (req: express.Request, res: express.Response) => {
  res.send("Backend Running Successfully");
});

// APIs Routes register kar rahe hain
app.use("/api/auth", authRouter);
app.use("/api/taxes", taxRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/orders", orderRouter);
app.use("/api/users", userRouter);
app.use("/api/testimonials", testimonialRouter);

// Global Error Handler Middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong on the server!" });
  },
);

export default app;
