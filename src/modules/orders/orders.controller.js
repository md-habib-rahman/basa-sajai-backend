import { orderService } from "./orders.service.js";

export const getOrders = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await orderService.getAllOrders({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      status,
    });

    res.json({
      success: true,
      data: result.items,
      meta: result.meta,
    });
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);

    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const order = await orderService.createOrder(req.body, userId);

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

export const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const updatedOrder = await orderService.updateOrder(id, req.body, userId);

    res.json({
      success: true,
      data: updatedOrder,
    });
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, actualReceivedAmount } = req.body;

    const updatedOrder = await orderService.updateOrderStatus(id, {
      status,
      actualReceivedAmount,
    });

    res.json({
      success: true,
      data: updatedOrder,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const result = await orderService.softDeleteOrder(id, userId);

    res.json({
      success: true,
      message: "Order soft-deleted and inventory restored successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const sendToSteadfast = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedOrder = await orderService.sendToSteadfast(id);

    res.json({
      success: true,
      data: updatedOrder,
      message: "Order sent to Steadfast successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const syncSteadfast = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedOrder = await orderService.syncSteadfastStatus(id);

    res.json({
      success: true,
      data: updatedOrder,
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    const suggestions = await orderService.searchCustomerSuggestions(q);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
};
