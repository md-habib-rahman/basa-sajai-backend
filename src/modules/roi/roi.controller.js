import { roiService } from './roi.service.js';

export const roiController = {
  async getMetrics(req, res, next) {
    try {
      const data = await roiService.getDashboardMetrics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};