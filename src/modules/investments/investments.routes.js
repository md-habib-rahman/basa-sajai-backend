import { Router } from "express";
import { investmentController } from "./investments.controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";

const router = Router();

router.use(requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"));

router.get("/", investmentController.getInvestments);
// router.get("/summary", investmentController.getSummary);
router.post("/", investmentController.createInvestment);
router.delete("/:id", investmentController.deleteInvestment);

export default router;
