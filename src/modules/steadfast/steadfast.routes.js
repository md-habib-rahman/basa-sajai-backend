import express from "express";
import { steadfastController } from "./steadfast.controller.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = express.Router();

// Webhook endpoint (Publicly reachable for Steadfast server)
router.post("/webhook", steadfastController.handleWebhook);

// Protected endpoints for dashboard
router.get("/balance", steadfastController.getMerchantBalance);
router.get("/logs", requireAuth, steadfastController.getWebhookLogs);

export default router;
