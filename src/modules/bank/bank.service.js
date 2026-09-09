import { prisma } from "../../config/db.js";
import { paginate } from "../../common/utils/paginate.js";

export const bankService = {
  async getAllTransactions({ page = 1, limit = 10, search = "", type = "" }) {
    const where = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { referenceNo: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    if (type && type !== "ALL") {
      where.type = type;
    }

    const paginated = await paginate(prisma.bankTransaction, {
      page,
      limit,
      where,
      orderBy: { transactionDate: "desc" },
      include: {
        order: {
          select: { orderNumber: true, customerName: true },
        },
      },
    });

    // Compute live balances
    const totals = await prisma.bankTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
    });

    let totalInflow = 0;
    let totalOutflow = 0;

    totals.forEach((group) => {
      if (group.type === "INFLOW") totalInflow = group._sum.amount || 0;
      if (group.type === "OUTFLOW") totalOutflow = group._sum.amount || 0;
    });

    return {
      ...paginated,
      summary: {
        totalInflow,
        totalOutflow,
        currentBalance: totalInflow - totalOutflow,
      },
    };
  },

  async createTransaction(data) {
    return await prisma.bankTransaction.create({
      data: {
        description: data.description,
        type: data.type || "INFLOW",
        amount: Number(data.amount || 0),
        referenceNo: data.referenceNo || null,
        notes: data.notes || null,
        transactionDate: data.transactionDate
          ? new Date(data.transactionDate)
          : new Date(),
      },
    });
  },

  async updateTransaction(id, data) {
    return await prisma.bankTransaction.update({
      where: { id },
      data: {
        description: data.description,
        type: data.type,
        amount: Number(data.amount || 0),
        referenceNo: data.referenceNo || null,
        notes: data.notes || null,
        transactionDate: data.transactionDate
          ? new Date(data.transactionDate)
          : undefined,
      },
    });
  },

  async deleteTransaction(id) {
    return await prisma.bankTransaction.delete({ where: { id } });
  },
};
