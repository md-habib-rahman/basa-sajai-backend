import { investmentService } from './investments.service.js';

export const investmentController = {
  async getInvestments(req, res, next) {
    try {
      const { page, limit, search } = req.query;
      const result = await investmentService.getAllInvestments({ page, limit, search });
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

  async createInvestment(req, res, next) {
    try {
      const data = await investmentService.createInvestment(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updateInvestment(req, res, next) {
    try {
      const data = await investmentService.updateInvestment(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async deleteInvestment(req, res, next) {
    try {
      await investmentService.deleteInvestment(req.params.id);
      res.json({ success: true, message: 'Investment entry deleted' });
    } catch (err) {
      next(err);
    }
  },
};