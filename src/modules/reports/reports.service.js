import { prisma } from "../../config/db.js";
import { paginate } from "../../common/utils/paginate.js";

export const simpleReportsService = {
  /**
   * 1A. Item-wise Inventory Report (Paginated)
   * Lists products with Total Stock In, Total Stock Out, and Current Stock.
   */
  async getItemWiseInventory({ page = 1, limit = 10, search = "" }) {
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

    const paginatedResult = await paginate(prisma.product, {
      page,
      limit,
      where,
      orderBy: { createdAt: "desc" },
      include: {
        inventoryLogs: {
          select: {
            quantityChange: true,
            changeType: true,
          },
        },
      },
    });

    const items = paginatedResult.items.map((product) => {
      let totalStockIn = 0;
      let totalStockOut = 0;

      product.inventoryLogs.forEach((log) => {
        if (log.quantityChange > 0) {
          totalStockIn += log.quantityChange;
        } else {
          totalStockOut += Math.abs(log.quantityChange);
        }
      });

      return {
        id: product.id,
        title: product.title,
        sku: product.sku,
        totalStockIn,
        totalStockOut,
        currentStock: product.stockQuantity,
      };
    });

    return {
      data: items,
      meta: paginatedResult.meta,
    };
  },

  /**
   * 1B. Date-wise Inventory Report
   * Groups audit logs by date (YYYY-MM-DD) showing Stock In, Stock Out, and Net Movement.
   */
  async getDateWiseInventory({ startDate, endDate }) {
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const logs = await prisma.inventoryLog.findMany({
      where:
        Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
      orderBy: { createdAt: "desc" },
    });

    const dateMap = {};

    logs.forEach((log) => {
      const dateKey = new Date(log.createdAt).toISOString().split("T")[0];

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          stockIn: 0,
          stockOut: 0,
          netChange: 0,
          totalLogCount: 0,
        };
      }

      if (log.quantityChange > 0) {
        dateMap[dateKey].stockIn += log.quantityChange;
      } else {
        dateMap[dateKey].stockOut += Math.abs(log.quantityChange);
      }

      dateMap[dateKey].netChange += log.quantityChange;
      dateMap[dateKey].totalLogCount += 1;
    });

    return Object.values(dateMap);
  },

  /**
   * 2A. Customer-wise Order Report (Paginated)
   * Groups orders by Customer Phone/Name, showing dates and items purchased.
   */
  async getCustomerWiseOrders({ page = 1, limit = 10, search = "" }) {
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: "insensitive" } },
              { customerPhone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return await paginate(prisma.order, {
      page,
      limit,
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: {
            title: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });
  },
};
