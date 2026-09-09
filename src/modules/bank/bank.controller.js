import { bankService } from "./bank.service.js";

export const bankController = {
  async getTransactions(req, res, next) {
    try {
      const { page, limit, search, type } = req.query;
      const result = await bankService.getAllTransactions({
        page,
        limit,
        search,
        type,
      });
      res.json({
        success: true,
        data: result.items,
        meta: result.meta,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  },

  async createTransaction(req, res, next) {
    try {
      const data = await bankService.createTransaction(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updateTransaction(req, res, next) {
    try {
      const data = await bankService.updateTransaction(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async deleteTransaction(req, res, next) {
    try {
      await bankService.deleteTransaction(req.params.id);
      res.json({ success: true, message: "Bank transaction record deleted" });
    } catch (err) {
      next(err);
    }
  },
};
