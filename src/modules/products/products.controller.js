import { productService } from "./products.service.js";

export const getProducts = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await productService.getAllProducts({ page, limit, search });
    res.json({ success: true, data: result.items, meta: result.meta });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const data = await productService.createProduct(req.body);

    res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const patchProduct = async (req, res, next) => {
  try {
    const data = await productService.patchProduct(req.params.id, req.body);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const data = await productService.updateProduct(req.params.id, req.body);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.params.id);

    res.json({
      success: true,
      message: "Product deleted",
    });
  } catch (err) {
    next(err);
  }
};
