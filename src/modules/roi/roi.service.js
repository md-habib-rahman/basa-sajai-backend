import { prisma } from '../../config/db.js';

export const roiService = {
  async getDashboardMetrics() {
    // 1. Total Capital Injected from Investments
    const investmentAgg = await prisma.investment.aggregate({
      _sum: {
        totalCost: true,
        habibContribution: true,
        robiulContribution: true,
      },
    });

    const totalInvestment = investmentAgg._sum.totalCost || 0;
    const habibInvestment = investmentAgg._sum.habibContribution || 0;
    const robiulInvestment = investmentAgg._sum.robiulContribution || 0;

    // 2. Revenue from Delivered / Active Orders
    const orderAgg = await prisma.order.aggregate({
      _sum: {
        totalAmount: true,
        deliveryFee: true,
        discountAmount: true,
      },
      where: {
        status: {
          not: 'CANCELLED',
        },
      },
    });

    const totalRevenue = orderAgg._sum.totalAmount || 0;

    // 3. Delivered Order Items Cost of Goods Sold (COGS)
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            not: 'CANCELLED',
          },
        },
      },
      include: {
        product: true,
      },
    });

    const totalCogs = orderItems.reduce((acc, item) => {
      const landedCost = item.product?.totalLandedCost || 0;
      return acc + landedCost * item.quantity;
    }, 0);

    // 4. Inventory Valuation
    const products = await prisma.product.findMany();
    const inventoryValuation = products.reduce((acc, p) => {
      return acc + p.stockQuantity * p.totalLandedCost;
    }, 0);

    // 5. Profit & ROI Metrics
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = totalRevenue - totalInvestment; // Net profit relative to total capital pool
    const roiPercentage = totalInvestment > 0 ? ((netProfit / totalInvestment) * 100).toFixed(2) : 0;

    // 6. 50/50 Partner Profit Share
    const habibProfitShare = netProfit / 2;
    const robiulProfitShare = netProfit / 2;

    return {
      financials: {
        totalInvestment,
        habibInvestment,
        robiulInvestment,
        totalRevenue,
        totalCogs,
        grossProfit,
        netProfit,
        roiPercentage: Number(roiPercentage),
        inventoryValuation,
      },
      partnerShares: {
        habib: {
          contributed: habibInvestment,
          share: habibProfitShare,
        },
        robiul: {
          contributed: robiulInvestment,
          share: robiulProfitShare,
        },
      },
    };
  },
};