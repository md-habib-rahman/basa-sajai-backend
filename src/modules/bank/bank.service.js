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

    // Compute live balance totals
    const summary = await this.getSummary();

    return {
      ...paginated,
      summary,
    };
  },

  async getSummary() {
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
      totalInflow,
      totalOutflow,
      currentBalance: totalInflow - totalOutflow,
    };
  },

  async createTransaction(data) {
    const amount = Number(data.amount || 0);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Transaction amount must be a positive number");
    }

    return await prisma.bankTransaction.create({
      data: {
        description: data.description,
        type: data.type || "INFLOW",
        amount,
        referenceNo: data.referenceNo || null,
        notes: data.notes || null,
        transactionDate:
          data.transactionDate && !isNaN(Date.parse(data.transactionDate))
            ? new Date(data.transactionDate)
            : new Date(),
      },
    });
  },

  async updateTransaction(id, data) {
    const existing = await prisma.bankTransaction.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Bank transaction record not found");
    }

    const amount =
      data.amount !== undefined ? Number(data.amount) : existing.amount;

    if (isNaN(amount) || amount <= 0) {
      throw new Error("Transaction amount must be a positive number");
    }

    return await prisma.bankTransaction.update({
      where: { id },
      data: {
        description: data.description ?? existing.description,
        type: data.type ?? existing.type,
        amount,
        referenceNo:
          data.referenceNo !== undefined
            ? data.referenceNo
            : existing.referenceNo,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        transactionDate:
          data.transactionDate && !isNaN(Date.parse(data.transactionDate))
            ? new Date(data.transactionDate)
            : existing.transactionDate,
      },
    });
  },

  async deleteTransaction(id) {
    const existing = await prisma.bankTransaction.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Bank transaction record not found");
    }

    return await prisma.bankTransaction.delete({ where: { id } });
  },
};
