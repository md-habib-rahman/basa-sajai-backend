import { steadfastService } from "./steadfast.service.js";
import { prisma } from "../../config/db.js";
import { orderService } from "../orders/orders.service.js";
import crypto from "node:crypto";

export const steadfastController = {
  /**
   * Webhook endpoint called by Steadfast on status changes
   */

  async handleWebhook(req, res, next) {
    try {
      // Payload has already been:
      // 1. Received as raw Buffer
      // 2. HMAC verified
      // 3. JSON parsed
      // by verifySteadfastWebhook middleware

      const payload = req.parsedBody || {};

      const {
        consignment_id,
        invoice,
        cod_amount,
        delivery_charge = 0,
        status,
        notification_type,
      } = payload;

      // ---------------------------------------------------------
      // 1. Validate webhook payload
      // ---------------------------------------------------------

      if (!consignment_id && !invoice) {
        return res.status(400).json({
          success: false,
          message: "Missing consignment_id or invoice in webhook payload",
        });
      }

      // ---------------------------------------------------------
      // 2. Calculate Net Payout
      // ---------------------------------------------------------

      const rawCod = Number(cod_amount || 0);
      const rawDeliveryCharge = Number(delivery_charge || 0);

      const baseAfterDelivery = Math.max(0, rawCod - rawDeliveryCharge);

      const codFee = Math.round(baseAfterDelivery * 0.01);

      const calculatedNetPayout = Math.max(0, baseAfterDelivery - codFee);

      // ---------------------------------------------------------
      // 3. Find Order
      // ---------------------------------------------------------

      const order = await prisma.order.findFirst({
        where: {
          OR: [
            consignment_id
              ? {
                  consignmentId: Number(consignment_id),
                }
              : undefined,

            invoice
              ? {
                  orderNumber: invoice,
                }
              : undefined,
          ].filter(Boolean),
        },
      });

      // ---------------------------------------------------------
      // 4. Log Webhook
      // ---------------------------------------------------------

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

      // ---------------------------------------------------------
      // 5. Order not found
      // ---------------------------------------------------------

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Callback logged, but no matching order found",
        });
      }

      // ---------------------------------------------------------
      // 6. Map Steadfast status → Application status
      // ---------------------------------------------------------

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

      // ---------------------------------------------------------
      // 7. Update Courier Information
      // ---------------------------------------------------------

      await prisma.order.update({
        where: {
          id: order.id,
        },

        data: {
          courierStatus: status,

          actualReceivedAmount:
            lowerStatus === "delivered"
              ? calculatedNetPayout
              : order.actualReceivedAmount,
        },
      });

      // ---------------------------------------------------------
      // 8. Sync Application Order Status
      // ---------------------------------------------------------

      await orderService.updateOrderStatus(order.id, {
        status: mappedStatus,

        actualReceivedAmount:
          lowerStatus === "delivered" ? calculatedNetPayout : undefined,
      });

      // ---------------------------------------------------------
      // 9. Respond to Steadfast
      // ---------------------------------------------------------

      return res.status(200).json({
        success: true,

        message: "Webhook processed successfully",

        data: {
          notificationType: notification_type,
          consignmentId: consignment_id,
          invoice,
          status,
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
