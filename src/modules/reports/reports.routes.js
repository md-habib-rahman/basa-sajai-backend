import { Router } from "express";
import {
  getCustomerWiseOrders,
  getItemWiseInventory,
  getDateWiseInventory,
} from "./reports.controller.js";

const router = Router();

router.get("/orders/customer-wise", getCustomerWiseOrders);
router.get("/inventory/item-wise", getItemWiseInventory);
router.get("/inventory/date-wise", getDateWiseInventory);

export default router;
