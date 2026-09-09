import { prisma } from "../../config/db.js";
import { paginate } from "../../common/utils/paginate.js";
import { generateOrderNumber } from "./generateOrderNumber.js";

export const orderService = {
  async getAllOrders({ page = 1, limit = 10, search = "", status = "" }) {
    const where = {};

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
      include: { items: true },
    });
  },

  async createOrder(data) {
    const {
      customerName,
      customerPhone,
      shippingAddress,
      deliveryFee = 0,
      discountAmount = 0,
      items,
      notes,
    } = data;

    // const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = await generateOrderNumber();
    // console.log(orderNumber)

    let itemsTotal = 0;
    const preparedItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      if (product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.title}`);
      }

      // Use manually specified price OR fallback to actual/calculated selling price
      const effectiveUnitPrice =
        item.unitPrice !== undefined &&
        item.unitPrice !== null &&
        item.unitPrice !== ""
          ? Number(item.unitPrice)
          : product.actualSellingPrice || product.sellingPrice;

      const itemTotal = effectiveUnitPrice * Number(item.quantity);
      itemsTotal += itemTotal;

      preparedItems.push({
        productId: product.id,
        title: product.title,
        quantity: Number(item.quantity),
        unitPrice: effectiveUnitPrice,
        total: itemTotal,
      });
    }

    const grandTotal = Math.max(
      0,
      itemsTotal + Number(deliveryFee || 0) - Number(discountAmount || 0),
    );

    return await prisma.$transaction(async (tx) => {
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
        include: { items: true },
      });

      for (const item of preparedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return newOrder;
    });
  },

  async updateOrder(id, data) {
    return await prisma.order.update({
      where: { id },
      data: {
        actualReceivedAmount:
          data.actualReceivedAmount !== undefined &&
          data.actualReceivedAmount !== ""
            ? Number(data.actualReceivedAmount)
            : null,
      },
      include: { items: true },
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

    // AUTO-CREDIT / DE-CREDIT LOGIC FOR BANK PAGE
    const creditAmount =
      updatedOrder.actualReceivedAmount !== null &&
      updatedOrder.actualReceivedAmount !== undefined
        ? updatedOrder.actualReceivedAmount
        : updatedOrder.totalAmount;

    if (updatedOrder.status === "DELIVERED") {
      // Upsert Auto-Credit Bank Transaction
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
      // If status changed away from DELIVERED, remove auto-credit
      await prisma.bankTransaction.deleteMany({
        where: { orderId: updatedOrder.id },
      });
    }

    return updatedOrder;
  },
  async deleteOrder(id) {
    return await prisma.order.delete({ where: { id } });
  },
};
