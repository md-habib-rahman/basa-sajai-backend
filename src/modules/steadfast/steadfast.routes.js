import { Router, raw } from "express";
import { steadfastController } from "./steadfast.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { verifySteadfastWebhook } from "../../middlewares/verifySteadfastWebhook.js";

const router = Router();

// Webhook endpoint (Publicly reachable for Steadfast server)
router.post(
  "/",
  raw({ type: "application/json" }),
  verifySteadfastWebhook,
  steadfastController.handleWebhook,
);

// Protected endpoints for dashboard
router.get("/balance", steadfastController.getMerchantBalance);
router.get("/logs", requireAuth, steadfastController.getWebhookLogs);

export default router;
