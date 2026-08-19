import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import { config } from "./config/env.js";
import productRoutes from "./modules/products/products.routes.js";
import investmentRoutes from "./modules/investments/investments.routes.js";
import orderRoutes from "./modules/orders/orders.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import roiRoutes from "./modules/roi/roi.routes.js";

const app = express();

// 1. CORS Configuration (Allows cookies/headers from Vite frontend)
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

// 2. Better Auth Catch-All Handler
app.use("/api/auth", (req, res) => {
  return toNodeHandler(auth)(req, res);
});

// 3. Body Parsers (For standard API routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. API Domain Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/investments", investmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roi", roiRoutes);

// 5. Health Check Route
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Welcome to the Basa Sajai API",
    timestamp: new Date(),
  });
});

// 6. Global Error Middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

export default app;
