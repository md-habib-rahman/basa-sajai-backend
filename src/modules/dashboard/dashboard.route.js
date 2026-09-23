import express from "express";
import { dashboardController } from "./dashboard.controller.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = express.Router();
router.get("/summary", requireAuth, dashboardController.getSummary);

export default router;
