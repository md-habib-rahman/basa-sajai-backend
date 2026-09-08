import { orderService } from "./orders.service.js";

export const getOrders = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;

    const result = await orderService.getAllOrders({
      page,
      limit,
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

// order.controller.js
export const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, actualReceivedAmount } = req.body;
    const order = await orderService.updateOrderStatus(
      id,
      status,
      actualReceivedAmount,
    );
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.body);

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await orderService.updateOrderStatus(id, status);

    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    await orderService.deleteOrder(req.params.id);

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};
