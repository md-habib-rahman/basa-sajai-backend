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
    const {
      customerName,
      customerPhone,
      shippingAddress,
      deliveryFee = 120,
      discountAmount = 0,
      notes,
      items = [],
    } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch existing order to revert previous stock deductions
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingOrder) {
        throw new Error("Order not found");
      }

      // Revert previous inventory stock levels
      for (const oldItem of existingOrder.items) {
        await tx.product.update({
          where: { id: oldItem.productId },
          data: { stockQuantity: { increment: oldItem.quantity } },
        });
      }

      // 2. Clear previous order items
      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      // 3. Process new items and deduct updated stock
      let itemsSubtotal = 0;
      const newItemsData = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        const effectiveUnitPrice =
          item.unitPrice !== undefined && item.unitPrice !== ""
            ? Number(item.unitPrice)
            : product.actualSellingPrice || product.sellingPrice;

        const lineTotal = effectiveUnitPrice * Number(item.quantity);
        itemsSubtotal += lineTotal;

        newItemsData.push({
          productId: product.id,
          title: product.title,
          quantity: Number(item.quantity),
          unitPrice: effectiveUnitPrice,
          total: lineTotal,
        });

        // Deduct updated stock quantity
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: { decrement: Number(item.quantity) } },
        });
      }

      const newGrandTotal = Math.max(
        0,
        itemsSubtotal + Number(deliveryFee) - Number(discountAmount),
      );

      // 4. Update Order details
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          customerName,
          customerPhone,
          shippingAddress,
          deliveryFee: Number(deliveryFee),
          discountAmount: Number(discountAmount),
          totalAmount: newGrandTotal,
          notes: notes || null,
          items: {
            create: newItemsData,
          },
        },
        include: { items: true },
      });

      // 5. Re-sync auto-credit in Bank Ledger if delivered
      if (updatedOrder.status === "DELIVERED") {
        const creditAmount =
          updatedOrder.actualReceivedAmount !== null &&
          updatedOrder.actualReceivedAmount !== undefined
            ? updatedOrder.actualReceivedAmount
            : updatedOrder.totalAmount;

        await tx.bankTransaction.upsert({
          where: {
            id:
              (await tx.bankTransaction.findFirst({ where: { orderId: id } }))
                ?.id || "",
          },
          update: {
            amount: creditAmount,
            description: `Auto-Credit: Order #${updatedOrder.orderNumber} Delivered`,
          },
          create: {
            orderId: updatedOrder.id,
            description: `Auto-Credit: Order #${updatedOrder.orderNumber} Delivered`,
            type: "INFLOW",
            amount: creditAmount,
            referenceNo: updatedOrder.orderNumber,
            notes: `Auto-generated credit upon delivery for customer ${updatedOrder.customerName}`,
          },
        });
      }

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
