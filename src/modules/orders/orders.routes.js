import express from "express";
import {
  getOrders,
  createOrder,
  updateStatus,
  deleteOrder,
} from "./orders.controller.js";

const router = express.Router();

router.get("/", getOrders);
router.post("/", createOrder);
router.patch("/:id/status", updateStatus);
router.delete("/:id", deleteOrder);

export default router;
