import { steadfastService } from "./steadfast.service.js";
import { prisma } from "../../config/db.js";
import { orderService } from "../orders/orders.service.js";

export const steadfastController = {
  /**
   * Webhook endpoint called by Steadfast on status changes
   */
  async handleWebhook(req, res, next) {
    try {
      const payload = req.body || {};
      const {
        consignment_id,
        invoice,
        cod_amount,
        delivery_charge = 0,
        status,
      } = payload;

      if (!consignment_id && !invoice) {
        return res.status(400).json({
          success: false,
          message: "Missing consignment_id or invoice in webhook payload",
        });
      }

      // 1. Calculate Net Payout: cod_amount - delivery_charge - round(cod_amount * 0.01)
      const rawCod = Number(cod_amount || 0);
      const rawDeliveryCharge = Number(delivery_charge || 0);

      const baseAfterDelivery = Math.max(0, rawCod - rawDeliveryCharge);
      const codFee = Math.round(baseAfterDelivery * 0.01);
      const calculatedNetPayout = Math.max(0, baseAfterDelivery - codFee);

      // 2. Find Order by consignmentId or orderNumber (invoice)
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            {
              consignmentId: consignment_id
                ? Number(consignment_id)
                : undefined,
            },
            { orderNumber: invoice },
          ],
        },
      });

      // 3. Save Raw Callback in DB (CourierWebhookLog)
      await prisma.courierWebhookLog.create({
        data: {
          orderId: order?.id || null,
          consignmentId: consignment_id ? Number(consignment_id) : null,
          invoice: invoice || null,
          status: status || "unknown",
          codAmount: rawCod,
          deliveryCharge: rawDeliveryCharge,
          netPayout: calculatedNetPayout,
          rawPayload: payload,
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Callback logged, but no matching order found",
        });
      }

      // 4. Map Steadfast status to Basa Sajai OrderStatus
      let mappedStatus = order.status;
      const lowerStatus = (status || "").toLowerCase();

      if (lowerStatus === "delivered") {
        mappedStatus = "DELIVERED";
      } else if (
        lowerStatus === "cancelled" ||
        lowerStatus === "partial_delivered_cancelled" ||
        lowerStatus === "returned"
      ) {
        mappedStatus = "CANCELLED";
      } else if (lowerStatus === "in_review" || lowerStatus === "pending") {
        mappedStatus = "PROCESSING";
      } else if (
        lowerStatus === "delivered_approval_pending" ||
        lowerStatus === "transit" ||
        lowerStatus === "delivery_status"
      ) {
        mappedStatus = "SHIPPED";
      }

      // 5. Update Order with net received payout and status
      await prisma.order.update({
        where: { id: order.id },
        data: {
          courierStatus: status,
          actualReceivedAmount:
            lowerStatus === "delivered"
              ? calculatedNetPayout
              : order.actualReceivedAmount,
        },
      });

      // 6. Sync Order Status & Bank Auto-Credit
      await orderService.updateOrderStatus(order.id, {
        status: mappedStatus,
        actualReceivedAmount:
          lowerStatus === "delivered" ? calculatedNetPayout : undefined,
      });

      res.json({
        success: true,
        message: "Webhook processed, logged, and order updated successfully",
        data: {
          consignmentId: consignment_id,
          calculatedNetPayout,
          mappedStatus,
        },
      });
    } catch (err) {
      console.error("Steadfast Webhook Error:", err);
      next(err);
    }
  },

  async getWebhookLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { invoice: { contains: search, mode: "insensitive" } },
              { status: { contains: search, mode: "insensitive" } },
              {
                consignmentId: isNaN(Number(search))
                  ? undefined
                  : Number(search),
              },
            ],
          }
        : {};

      const [logs, total] = await Promise.all([
        prisma.courierWebhookLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            order: {
              select: {
                orderNumber: true,
                customerName: true,
                customerPhone: true,
              },
            },
          },
        }),
        prisma.courierWebhookLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: logs,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get Steadfast Merchant Balance
   */
  async getMerchantBalance(req, res, next) {
    try {
      const data = await steadfastService.getBalance();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
