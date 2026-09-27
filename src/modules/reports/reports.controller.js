import { simpleReportsService } from "./reports.service.js";

export const getItemWiseInventory = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await simpleReportsService.getItemWiseInventory({
      page,
      limit,
      search,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getDateWiseInventory = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await simpleReportsService.getDateWiseInventory({
      startDate,
      endDate,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getCustomerWiseOrders = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const result = await simpleReportsService.getCustomerWiseOrders({
      page,
      limit,
      search,
    });
    res.json({ success: true, data: result.items, meta: result.meta });
  } catch (err) {
    next(err);
  }
};
