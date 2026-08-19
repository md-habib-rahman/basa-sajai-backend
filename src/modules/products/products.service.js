import { prisma } from "../../config/db.js";
import { paginate } from "../../common/utils/paginate.js";

const calculateCosting = (data) => {
  const qty = Math.max(Number(data.stockQuantity || 1), 1);
  const totalPurchase = Number(data.totalPurchasePrice || 0);
  const shipping = Number(data.shippingCost || 0);
  const marketing = Number(data.marketingCost || 0);
  const packaging = Number(data.packagingCost || 0);

  const unitPrice = totalPurchase / qty;
  const unitShipping = shipping / qty;
  const totalLandedCost = unitPrice + unitShipping + marketing + packaging;
  const sellingPrice = Math.round(totalLandedCost * 1.4);

  return { unitPrice, totalLandedCost, sellingPrice };
};

export const productService = {
  async getAllProducts({ page = 1, limit = 10, search = "" }) {
    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    return await paginate(prisma.product, {
      page,
      limit,
      where,
      orderBy: { createdAt: "desc" },
    });
  },

  async createProduct(data) {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sku = `BS-PRD-${randomHex}`;
    const costing = calculateCosting(data);

    return await prisma.product.create({
      data: {
        title: data.title,
        sku,
        imageUrl: data.imageUrl || null,
        stockQuantity: Number(data.stockQuantity || 0),
        totalPurchasePrice: Number(data.totalPurchasePrice || 0),
        shippingCost: Number(data.shippingCost || 0),
        marketingCost: Number(data.marketingCost || 0),
        packagingCost: Number(data.packagingCost || 0),
        actualSellingPrice: data.actualSellingPrice
          ? Number(data.actualSellingPrice)
          : null,
        unitPrice: costing.unitPrice,
        totalLandedCost: costing.totalLandedCost,
        sellingPrice: costing.sellingPrice,
      },
    });
  },

  async updateProduct(id, data) {
    const costing = calculateCosting(data);

    return await prisma.product.update({
      where: { id },
      data: {
        title: data.title,
        imageUrl: data.imageUrl,
        stockQuantity: Number(data.stockQuantity || 0),
        totalPurchasePrice: Number(data.totalPurchasePrice || 0),
        shippingCost: Number(data.shippingCost || 0),
        marketingCost: Number(data.marketingCost || 0),
        packagingCost: Number(data.packagingCost || 0),
        actualSellingPrice: data.actualSellingPrice
          ? Number(data.actualSellingPrice)
          : null,
        unitPrice: costing.unitPrice,
        totalLandedCost: costing.totalLandedCost,
        sellingPrice: costing.sellingPrice,
      },
    });
  },

  async patchProduct(id, partialData) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error("Product not found");

    const merged = { ...existing, ...partialData };
    const costing = calculateCosting(merged);

    return await prisma.product.update({
      where: { id },
      data: {
        ...partialData,
        actualSellingPrice:
          partialData.actualSellingPrice !== undefined
            ? Number(partialData.actualSellingPrice)
            : existing.actualSellingPrice,
        unitPrice: costing.unitPrice,
        totalLandedCost: costing.totalLandedCost,
        sellingPrice: costing.sellingPrice,
      },
    });
  },

  async deleteProduct(id) {
    return await prisma.product.delete({ where: { id } });
  },
};
