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

export const getProductById = async (req, res, next) => {
  try {
    const data = await productService.getProductById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const data = await productService.createProduct(req.body, userId);

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
    const userId = req.user?.id || null;
    const data = await productService.patchProduct(
      req.params.id,
      req.body,
      userId,
    );

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
    const userId = req.user?.id || null;
    const data = await productService.updateProduct(
      req.params.id,
      req.body,
      userId,
    );

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
      message: "Product soft-deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const getInventoryDiscrepancyReport = async (req, res, next) => {
  try {
    const report = await productService.getInventoryDiscrepancyReport();

    res.json({
      success: true,
      data: report,
      discrepancyCount: report.filter((r) => r.hasDiscrepancy).length,
    });
  } catch (err) {
    next(err);
  }
};

export const getInventoryLogs = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await productService.getInventoryLogs({
      page,
      limit,
      search,
    });

    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (err) {
    next(err);
  }
};
