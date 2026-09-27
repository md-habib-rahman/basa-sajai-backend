import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async getSummary(req, res, next) {
    try {
      const data = await dashboardService.getSummary();

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};
