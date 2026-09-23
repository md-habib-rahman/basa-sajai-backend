import express from "express";
import {
  getOrders,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  sendToSteadfast,
  syncSteadfast,
} from "./orders.controller.js";

import { requireAuth, requireRoles } from "../../middlewares/auth.js";

const router = express.Router();
router.use(requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"));

router.get("/", getOrders);
router.post("/", createOrder);
router.put("/:id", updateOrder);
// router.patch("/:id/status", updateStatus);
router.patch("/:id/status", updateOrderStatus);
router.delete("/:id", deleteOrder);
router.post("/:id/send-to-steadfast", sendToSteadfast);
router.post("/:id/sync-steadfast", syncSteadfast);

export default router;
