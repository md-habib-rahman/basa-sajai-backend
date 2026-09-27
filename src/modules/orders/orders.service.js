import { prisma } from "../../config/db.js";
import { paginate } from "../../common/utils/paginate.js";
import { generateOrderNumber } from "./generateOrderNumber.js";
import { steadfastService } from "../steadfast/steadfast.service.js";

export const orderService = {
  async getAllOrders({ page = 1, limit = 10, search = "", status = "" }) {
    const where = {
      deletedAt: null, // Exclude soft-deleted orders
    };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    return await paginate(prisma.order, {
      page,
      limit,
      where,
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } },
    });
  },

  async getOrderById(id) {
    const order = await prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    return order;
  },

  async createOrder(data, userId = null) {
    const {
      customerName,
      customerPhone,
      shippingAddress,
      deliveryFee = 0,
      discountAmount = 0,
      items = [],
      notes,
    } = data;

    const orderNumber = await generateOrderNumber();

    let itemsTotal = 0;
    const preparedItems = [];

    // Pre-validate stock availability for all products before transaction
    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, deletedAt: null },
      });

      if (!product) {
        throw new Error(`Product not found or inactive: ${item.productId}`);
      }

      if (product.stockQuantity < Number(item.quantity)) {
        throw new Error(
          `Insufficient stock for "${product.title}". Requested: ${item.quantity}, Available: ${product.stockQuantity}`,
        );
      }

      const effectiveUnitPrice =
        item.unitPrice !== undefined &&
        item.unitPrice !== null &&
        item.unitPrice !== ""
          ? Number(item.unitPrice)
          : product.actualSellingPrice || product.sellingPrice;

      const lineTotal = effectiveUnitPrice * Number(item.quantity);
      itemsTotal += lineTotal;

      preparedItems.push({
        productId: product.id,
        title: product.title,
        quantity: Number(item.quantity),
        unitPrice: effectiveUnitPrice,
      });
    }

    const grandTotal = Math.max(
      0,
      itemsTotal + Number(deliveryFee || 0) - Number(discountAmount || 0),
    );

    return await prisma.$transaction(async (tx) => {
      // 1. Create Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerName,
          customerPhone,
          shippingAddress,
          deliveryFee: Number(deliveryFee || 0),
          discountAmount: Number(discountAmount || 0),
          totalAmount: grandTotal,
          notes: notes || null,
          items: {
            create: preparedItems,
          },
        },
        include: { items: { include: { product: true } } },
      });

      // 2. Decrement Product Stock & Create Inventory Logs
      for (const item of preparedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            orderId: newOrder.id,
            userId,
            changeType: "ORDER_CREATED",
            quantityChange: -item.quantity,
            note: `Deducted ${item.quantity} units for Order #${newOrder.orderNumber}`,
          },
        });
      }

      return newOrder;
    });
  },

  async updateOrder(id, data, userId = null) {
    const {
      customerName,
      customerPhone,
      shippingAddress,
      deliveryFee = 0,
      discountAmount = 0,
      status,
      notes,
      items = [],
    } = data;

    // Fetch existing order with current items
    const existingOrder = await prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (!existingOrder) {
      throw new Error("Order not found");
    }

    // 1. Pre-validate stock availability for the NEW items
    // Account for stock that will be returned from existing items if they overlap
    let itemsTotal = 0;
    const preparedItems = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, deletedAt: null },
      });

      if (!product) {
        throw new Error(`Product not found or inactive: ${item.productId}`);
      }

      // Calculate how many items of this product were previously reserved in this order
      const existingLineItem = existingOrder.items.find(
        (i) => i.productId === item.productId,
      );
      const previouslyReserved = existingLineItem
        ? existingLineItem.quantity
        : 0;
      const effectiveAvailableStock =
        product.stockQuantity + previouslyReserved;

      if (effectiveAvailableStock < Number(item.quantity)) {
        throw new Error(
          `Insufficient stock for "${product.title}". Requested: ${item.quantity}, Available: ${effectiveAvailableStock}`,
        );
      }

      const effectiveUnitPrice =
        item.unitPrice !== undefined &&
        item.unitPrice !== null &&
        item.unitPrice !== ""
          ? Number(item.unitPrice)
          : product.actualSellingPrice || product.sellingPrice;

      const lineTotal = effectiveUnitPrice * Number(item.quantity);
      itemsTotal += lineTotal;

      preparedItems.push({
        productId: product.id,
        title: product.title,
        quantity: Number(item.quantity),
        unitPrice: effectiveUnitPrice,
      });
    }

    const grandTotal = Math.max(
      0,
      itemsTotal + Number(deliveryFee || 0) - Number(discountAmount || 0),
    );

    // Execute atomic update transaction
    return await prisma.$transaction(async (tx) => {
      // Step A: Revert old product stock reserves
      for (const oldItem of existingOrder.items) {
        await tx.product.update({
          where: { id: oldItem.productId },
          data: {
            stockQuantity: {
              increment: oldItem.quantity,
            },
          },
        });

        await tx.inventoryLog.create({
          data: {
            productId: oldItem.productId,
            orderId: existingOrder.id,
            userId,
            changeType: "ORDER_EDIT",
            quantityChange: oldItem.quantity,
            note: `Returned ${oldItem.quantity} units for edit on Order #${existingOrder.orderNumber}`,
          },
        });
      }

      // Step B: Clear old order line items
      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      // Step C: Deduct stock for new order line items & log
      for (const newItem of preparedItems) {
        await tx.product.update({
          where: { id: newItem.productId },
          data: {
            stockQuantity: {
              decrement: newItem.quantity,
            },
          },
        });

        await tx.inventoryLog.create({
          data: {
            productId: newItem.productId,
            orderId: existingOrder.id,
            userId,
            changeType: "ORDER_EDIT",
            quantityChange: -newItem.quantity,
            note: `Re-allocated ${newItem.quantity} units for Order #${existingOrder.orderNumber}`,
          },
        });
      }

      // Step D: Update Order record
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          customerName: customerName ?? existingOrder.customerName,
          customerPhone: customerPhone ?? existingOrder.customerPhone,
          shippingAddress: shippingAddress ?? existingOrder.shippingAddress,
          deliveryFee: Number(deliveryFee),
          discountAmount: Number(discountAmount),
          totalAmount: grandTotal,
          status: status || existingOrder.status,
          notes: notes !== undefined ? notes : existingOrder.notes,
          items: {
            create: preparedItems,
          },
        },
        include: { items: { include: { product: true } } },
      });

      return updatedOrder;
    });
  },

  async updateOrderStatus(id, { status, actualReceivedAmount }) {
    const updateData = {};

    if (status !== undefined && status !== null) {
      updateData.status = status;
    }

    if (actualReceivedAmount !== undefined) {
      updateData.actualReceivedAmount =
        actualReceivedAmount === "" || actualReceivedAmount === null
          ? null
          : Number(actualReceivedAmount);
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    const creditAmount =
      updatedOrder.actualReceivedAmount !== null &&
      updatedOrder.actualReceivedAmount !== undefined
        ? updatedOrder.actualReceivedAmount
        : updatedOrder.totalAmount;

    if (updatedOrder.status === "DELIVERED") {
      const existingTx = await prisma.bankTransaction.findFirst({
        where: { orderId: updatedOrder.id },
      });

      if (existingTx) {
        await prisma.bankTransaction.update({
          where: { id: existingTx.id },
          data: {
            amount: creditAmount,
            description: `Auto-Credit: Order #${updatedOrder.orderNumber} Delivered`,
            referenceNo: updatedOrder.orderNumber,
          },
        });
      } else {
        await prisma.bankTransaction.create({
          data: {
            orderId: updatedOrder.id,
            description: `Auto-Credit: Order #${updatedOrder.orderNumber} Delivered`,
            type: "INFLOW",
            amount: creditAmount,
            referenceNo: updatedOrder.orderNumber,
            notes: `Auto-generated credit upon delivery for customer ${updatedOrder.customerName}`,
          },
        });
      }
    } else {
      // If status changed away from DELIVERED, remove auto-credit entry
      await prisma.bankTransaction.deleteMany({
        where: { orderId: updatedOrder.id },
      });
    }

    return updatedOrder;
  },

  async softDeleteOrder(orderId, userId = null) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        include: { items: true },
      });

      if (!order) {
        throw new Error("Order not found or already deleted");
      }

      // Revert stock and write inventory log if order was not already cancelled
      if (order.status !== "CANCELLED") {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });

          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              orderId: order.id,
              userId,
              changeType: "ORDER_CANCELLED",
              quantityChange: item.quantity,
              note: `Stock restored from soft-deleted Order #${order.orderNumber}`,
            },
          });
        }
      }

      // Remove bank transaction auto-credits if any
      await tx.bankTransaction.deleteMany({
        where: { orderId: order.id },
      });

      // Soft delete order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          deletedAt: new Date(),
          status: "CANCELLED",
        },
      });

      return updatedOrder;
    });
  },

  async deleteOrder(id, userId = null) {
    return await this.softDeleteOrder(id, userId);
  },

  async sendToSteadfast(orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found or deleted");
    }

    if (order.consignmentId) {
      throw new Error(
        `Order #${order.orderNumber} is already sent to Steadfast (Consignment ID: ${order.consignmentId})`,
      );
    }

    const response = await steadfastService.createConsignment({
      invoice: order.orderNumber,
      recipient_name: order.customerName,
      recipient_phone: order.customerPhone,
      recipient_address: order.shippingAddress,
      cod_amount: order.totalAmount,
      note: order.notes || "",
    });

    if (response.status !== 200 || !response.consignment) {
      throw new Error(
        response.message || "Failed to create consignment with Steadfast",
      );
    }

    const consignment = response.consignment;

    return await prisma.order.update({
      where: { id: orderId },
      data: {
        consignmentId: consignment.consignment_id,
        trackingCode: consignment.tracking_code,
        courierStatus: consignment.status || "in_review",
        sentToCourierAt: new Date(),
        status: "SHIPPED",
      },
    });
  },

  async syncSteadfastStatus(orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
    });

    if (!order || !order.consignmentId) {
      throw new Error("Order has no consignment ID to track");
    }

    const response = await steadfastService.getStatusByCid(order.consignmentId);
    const courierStatus = response.delivery_status || response.status;

    let mappedStatus = order.status;
    const lower = (courierStatus || "").toLowerCase();
    if (lower === "delivered") mappedStatus = "DELIVERED";
    if (lower === "cancelled") mappedStatus = "CANCELLED";

    await prisma.order.update({
      where: { id: orderId },
      data: { courierStatus },
    });

    return await this.updateOrderStatus(orderId, { status: mappedStatus });
  },
};
