import express from "express";
import { roiController } from "./roi.controller.js";

const router = express.Router();

router.get("/", roiController.getMetrics);

export default router;
