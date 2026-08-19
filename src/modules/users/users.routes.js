import { Router } from "express";
import { getUsers, updateUser } from "./users.controller.js";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";

const router = Router();

// Only ADMIN and SUPER_ADMIN can access user administration
router.use(requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"));

router.get("/", getUsers);
router.patch("/:userId", updateUser);

export default router;
