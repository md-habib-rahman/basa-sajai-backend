import { prisma } from "../../config/db.js";
import { paginate } from "../../common/utils/paginate.js";

const calculateCosting = (data) => {
  const unitPrice = Number(data.unitPrice || 0);
  const marketingCost = Number(data.marketingCost || 0);
  const packagingCost = Number(data.packagingCost || 0);

  // Total base cost combines unit cost, marketing, and packaging
  const totalBaseCost = unitPrice + marketingCost + packagingCost;

  // Recommended selling price with 40% markup on total base cost
  const sellingPrice = Math.round(totalBaseCost * 1.4);

  return { unitPrice, marketingCost, packagingCost, sellingPrice };
};

export const productService = {
  async getAllProducts({ page = 1, limit = 10, search = "" }) {
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return await paginate(prisma.product, {
      page,
      limit,
      where,
      orderBy: { createdAt: "desc" },
    });
  },

  async getProductById(id) {
    const product = await prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new Error("Product not found");
    return product;
  },

  async createProduct(data, userId = null) {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sku = `BS-PRD-${randomHex}`;
    const costing = calculateCosting(data);
    const stockQuantity = Number(data.stockQuantity || 0);

    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          title: data.title,
          sku,
          imageUrl: data.imageUrl || null,
          stockQuantity,
          unitPrice: costing.unitPrice,
          marketingCost: Number(data.marketingCost || 0),
          packagingCost: Number(data.packagingCost || 0),
          sellingPrice: costing.sellingPrice,
          actualSellingPrice: data.actualSellingPrice
            ? Number(data.actualSellingPrice)
            : null,
        },
      });

      if (stockQuantity > 0) {
        await tx.inventoryLog.create({
          data: {
            productId: product.id,
            userId,
            changeType: "RESTOCK",
            quantityChange: stockQuantity,
            note: `Initial stock added during creation of product ${product.title}`,
          },
        });
      }

      return product;
    });
  },

  async updateProduct(id, data, userId = null) {
    const costing = calculateCosting(data);
    const newStock = Number(data.stockQuantity || 0);

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new Error("Product not found");

      const stockDelta = newStock - existing.stockQuantity;

      const updated = await tx.product.update({
        where: { id },
        data: {
          title: data.title,
          imageUrl: data.imageUrl,
          stockQuantity: newStock,
          unitPrice: costing.unitPrice,
          marketingCost: Number(data.marketingCost || 0),
          packagingCost: Number(data.packagingCost || 0),
          sellingPrice: costing.sellingPrice,
          actualSellingPrice: data.actualSellingPrice
            ? Number(data.actualSellingPrice)
            : null,
        },
      });

      if (stockDelta !== 0) {
        await tx.inventoryLog.create({
          data: {
            productId: id,
            userId,
            changeType: "MANUAL_ADJUSTMENT",
            quantityChange: stockDelta,
            note: `Stock updated manually from ${existing.stockQuantity} to ${newStock}`,
          },
        });
      }

      return updated;
    });
  },

  async patchProduct(id, partialData, userId = null) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new Error("Product not found");

      const merged = { ...existing, ...partialData };
      const costing = calculateCosting(merged);

      const updated = await tx.product.update({
        where: { id },
        data: {
          ...partialData,
          unitPrice:
            partialData.unitPrice !== undefined
              ? Number(partialData.unitPrice)
              : existing.unitPrice,
          stockQuantity:
            partialData.stockQuantity !== undefined
              ? Number(partialData.stockQuantity)
              : existing.stockQuantity,
          actualSellingPrice:
            partialData.actualSellingPrice !== undefined
              ? Number(partialData.actualSellingPrice)
              : existing.actualSellingPrice,
          sellingPrice: costing.sellingPrice,
        },
      });

      if (
        partialData.stockQuantity !== undefined &&
        Number(partialData.stockQuantity) !== existing.stockQuantity
      ) {
        const stockDelta =
          Number(partialData.stockQuantity) - existing.stockQuantity;
        await tx.inventoryLog.create({
          data: {
            productId: id,
            userId,
            changeType: "MANUAL_ADJUSTMENT",
            quantityChange: stockDelta,
            note: `Stock patched from ${existing.stockQuantity} to ${partialData.stockQuantity}`,
          },
        });
      }

      return updated;
    });
  },

  async deleteProduct(id) {
    const existing = await prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("Product not found or already deleted");

    return await prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  },

  async getInventoryLogs({ page = 1, limit = 10, search = "" } = {}) {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    const where = search
      ? {
          OR: [
            { note: { contains: search, mode: "insensitive" } },
            { product: { title: { contains: search, mode: "insensitive" } } },
            { product: { sku: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {};

    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              sku: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      }),
      prisma.inventoryLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        currentPage: pageNum,
        itemsPerPage: limitNum,
        totalItems: total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  //   {
  //     "totalItems": 20,
  //     "itemCount": 10,
  //     "itemsPerPage": 10,
  //     "totalPages": 2,
  //     "currentPage": 1,
  //     "hasNextPage": true,
  //     "hasPrevPage": false
  // }

  async getInventoryDiscrepancyReport() {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        orderItems: {
          where: {
            order: {
              status: { in: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] },
              deletedAt: null,
            },
          },
        },
        inventoryLogs: true,
      },
    });

    return products.map((product) => {
      const totalOrderedQuantity = product.orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const loggedStockMovement = product.inventoryLogs.reduce(
        (sum, log) => sum + log.quantityChange,
        0,
      );

      return {
        id: product.id,
        title: product.title,
        sku: product.sku,
        currentStockInDB: product.stockQuantity,
        totalSoldInActiveOrders: totalOrderedQuantity,
        totalLoggedMovement: loggedStockMovement,
        hasDiscrepancy:
          loggedStockMovement !== 0 &&
          product.stockQuantity !== loggedStockMovement,
      };
    });
  },
};
