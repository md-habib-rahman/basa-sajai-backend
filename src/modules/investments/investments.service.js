import { prisma } from '../../config/db.js';
import { paginate } from '../../common/utils/paginate.js';

export const investmentService = {
  async getAllInvestments({ page = 1, limit = 10, search = '' }) {
    const where = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const paginated = await paginate(prisma.investment, {
      page,
      limit,
      where,
      orderBy: { investmentDate: 'desc' },
    });

    // Compute live total partnership metrics across all entries
    const totals = await prisma.investment.aggregate({
      _sum: {
        totalCost: true,
        habibContribution: true,
        robiulContribution: true,
      },
    });

    return {
      ...paginated,
      summary: {
        totalInvestment: totals._sum.totalCost || 0,
        habibTotal: totals._sum.habibContribution || 0,
        robiulTotal: totals._sum.robiulContribution || 0,
      },
    };
  },

  async createInvestment(data) {
    let habib = Number(data.habibContribution || 0);
    let robiul = Number(data.robiulContribution || 0);
    const total = Number(data.totalCost || 0);

    // Auto-fill contributions based on Purchaser if individual
    if (data.purchaser === 'HABIB' && habib === 0) habib = total;
    if (data.purchaser === 'ROBIUL' && robiul === 0) robiul = total;

    return await prisma.investment.create({
      data: {
        description: data.description,
        purchaser: data.purchaser || 'JOINT',
        totalCost: total,
        habibContribution: habib,
        robiulContribution: robiul,
        notes: data.notes || null,
        investmentDate: data.investmentDate ? new Date(data.investmentDate) : new Date(),
      },
    });
  },

  async updateInvestment(id, data) {
    let habib = Number(data.habibContribution || 0);
    let robiul = Number(data.robiulContribution || 0);
    const total = Number(data.totalCost || 0);

    if (data.purchaser === 'HABIB' && habib === 0) habib = total;
    if (data.purchaser === 'ROBIUL' && robiul === 0) robiul = total;

    return await prisma.investment.update({
      where: { id },
      data: {
        description: data.description,
        purchaser: data.purchaser,
        totalCost: total,
        habibContribution: habib,
        robiulContribution: robiul,
        notes: data.notes || null,
        investmentDate: data.investmentDate ? new Date(data.investmentDate) : undefined,
      },
    });
  },

  async deleteInvestment(id) {
    return await prisma.investment.delete({ where: { id } });
  },
};