import express from "express";
import {
  getProducts,
  createProduct,
  patchProduct,
  updateProduct,
  deleteProduct,
} from "./products.controller.js";

const router = express.Router();

router.get("/", getProducts);
router.post("/", createProduct);
router.patch("/:id", patchProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
