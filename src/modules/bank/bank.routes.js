import express from "express";
import { bankController } from "./bank.controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";

const router = express.Router();

router.use(requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"));

router.get("/", bankController.getTransactions);
router.post("/", bankController.createTransaction);
router.put("/:id", bankController.updateTransaction);
router.delete("/:id", bankController.deleteTransaction);

export default router;
