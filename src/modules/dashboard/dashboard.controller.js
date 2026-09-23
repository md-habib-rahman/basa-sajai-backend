import { prisma } from "../../config/db.js";

export const dashboardController = {
  async getSummary(req, res, next) {
    try {
      // 1. Core Order Counts & High Risk Stock
      const [
        totalOrders,
        pendingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        lowStockProducts,
        bankTransactions,
        investments,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: "PENDING" } }),
        prisma.order.count({ where: { status: "SHIPPED" } }),
        prisma.order.count({ where: { status: "DELIVERED" } }),
        prisma.order.count({ where: { status: "CANCELLED" } }),
        prisma.product.findMany({
          where: {
            stockQuantity: { lte: 5 },
            // odel has minStockLevel field:
            // {
            //   stockQuantity: { lte: prisma.product.fields.minStockLevel }
            // }
          },
          select: {
            id: true,
            title: true,
            stockQuantity: true,
            sku: true,
            //minStockLevel: true, // optional if field exists
          },
          orderBy: { stockQuantity: "asc" }, // Shows lowest stock first
          take: 10,
        }),
        prisma.bankTransaction.findMany({
          take: 7,
          orderBy: { transactionDate: "desc" },
        }),
        await prisma.investment.findMany({
          select: {
            id: true,
            description: true,
            purchaser: true,
            totalCost: true,
            habibContribution: true,
            robiulContribution: true,
            investmentDate: true,
          },
          orderBy: { investmentDate: "asc" },
        }),
      ]);

      const totalHabibContribution = investments.reduce(
        (sum, inv) => sum + inv.habibContribution,
        0,
      );
      const totalRobiulContribution = investments.reduce(
        (sum, inv) => sum + inv.robiulContribution,
        0,
      );
      const totalInvestmentsAmount = investments.reduce(
        (sum, inv) => sum + inv.totalCost,
        0,
      );

      // 2. Financial Aggregates
      const grossRevenueResult = await prisma.order.aggregate({
        _sum: {
          totalAmount: true,
          actualReceivedAmount: true,
        },
        where: {
          status: { in: ["SHIPPED", "DELIVERED"] },
        },
      });

      const totalGrossSales = grossRevenueResult._sum.totalAmount || 0;
      const totalCourierPayouts =
        grossRevenueResult._sum.actualReceivedAmount || 0;

      // 3. Bank Balance Summary
      const bankInflow = await prisma.bankTransaction.aggregate({
        _sum: { amount: true },
        where: { type: "INFLOW" },
      });
      const bankOutflow = await prisma.bankTransaction.aggregate({
        _sum: { amount: true },
        where: { type: "OUTFLOW" },
      });

      const totalBankInflow = bankInflow._sum.amount || 0;
      const totalBankOutflow = bankOutflow._sum.amount || 0;
      const currentBankBalance = totalBankInflow - totalBankOutflow;

      // 4. Date-Wise Order Trend (Last 7 Days with Zero-Filling)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const recentOrders = await prisma.order.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true, totalAmount: true },
        orderBy: { createdAt: "asc" },
      });

      // Map recent orders count and revenue by YYYY-MM-DD
      const ordersByDateMap = {};
      recentOrders.forEach((ord) => {
        const dateKey = new Date(ord.createdAt).toISOString().split("T")[0];
        if (!ordersByDateMap[dateKey]) {
          ordersByDateMap[dateKey] = { count: 0, revenue: 0 };
        }
        ordersByDateMap[dateKey].count += 1;
        ordersByDateMap[dateKey].revenue += ord.totalAmount || 0;
      });

      // Build continuous 7-day timeline including zero-order days
      const dateWiseOrderData = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);

        const dateKey = d.toISOString().split("T")[0];
        const displayLabel = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        const dayData = ordersByDateMap[dateKey] || { count: 0, revenue: 0 };

        dateWiseOrderData.push({
          date: displayLabel,
          count: dayData.count,
          revenue: dayData.revenue,
        });
      }
      // 5. Total Capital Raised
      //   const totalInvestmentsAmount = investments.reduce(
      //     (sum, inv) => sum + inv.amount,
      //     0,
      //   );

      const totalWebhookCallbacks = await prisma.courierWebhookLog.count();

      res.json({
        success: true,
        data: {
          orders: {
            total: totalOrders,
            pending: pendingOrders,
            shipped: shippedOrders,
            delivered: deliveredOrders,
            cancelled: cancelledOrders,
            dateWiseTrend: dateWiseOrderData,
          },
          financials: {
            totalGrossSales,
            totalCourierPayouts,
            currentBankBalance,
            totalBankInflow,
            totalBankOutflow,
            totalInvestmentsAmount,
            totalHabibContribution,
            totalRobiulContribution,
            investmentsList: investments,
          },
          inventory: {
            lowStockCount: lowStockProducts.length,
            lowStockItems: lowStockProducts,
          },
          courier: {
            totalCallbacks: totalWebhookCallbacks,
          },
          recentBankTransactions: bankTransactions,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
