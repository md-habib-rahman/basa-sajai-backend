import express from "express";
import {
  getOrders,
  createOrder,
  updateStatus,
  updateOrderStatus,
  deleteOrder,
} from "./orders.controller.js";

const router = express.Router();

router.get("/", getOrders);
router.post("/", createOrder);
// router.patch("/:id/status", updateStatus);
router.patch('/:id/status', updateOrderStatus);
router.delete("/:id", deleteOrder);

export default router;
