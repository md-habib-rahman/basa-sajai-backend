import crypto from "node:crypto";

export const verifySteadfastWebhook = (req, res, next) => {
  const startedAt = Date.now();

  // Useful for identifying this request in logs
  const idempotencyKey =
    req.get("Idempotency-Key") || null;

  try {
    const secret = process.env.STEADFAST_WEBHOOK_SECRET;

    // ---------------------------------------------------------
    // 1. Check webhook secret configuration
    // ---------------------------------------------------------

    if (!secret) {
      console.error(
        "[STEADFAST WEBHOOK] FAILED: Secret is missing"
      );

      return res.status(500).json({
        success: false,
        message: "Webhook secret missing",
      });
    }

    // ---------------------------------------------------------
    // 2. Check Content-Type / raw body
    // ---------------------------------------------------------

    if (!Buffer.isBuffer(req.body)) {
      console.error(
        "[STEADFAST WEBHOOK] FAILED: Raw body is not available",
        {
          idempotencyKey,
          contentType: req.get("Content-Type"),
        }
      );

      return res.status(400).json({
        success: false,
        message: "Invalid webhook body",
      });
    }

    // ---------------------------------------------------------
    // 3. Verify Authorization header
    // ---------------------------------------------------------

    const authHeader = req.get("Authorization") || "";

    const [authType, authToken] = authHeader.split(" ");

    if (
      authType !== "Bearer" ||
      !authToken ||
      authToken.length !== secret.length ||
      !crypto.timingSafeEqual(
        Buffer.from(authToken),
        Buffer.from(secret)
      )
    ) {
      console.warn(
        "[STEADFAST WEBHOOK] FAILED: Invalid Authorization",
        {
          idempotencyKey,
          ip: req.ip,
        }
      );

      return res.status(401).json({
        success: false,
        message: "Invalid authorization",
      });
    }

    // ---------------------------------------------------------
    // 4. Verify HMAC-SHA256 signature
    // ---------------------------------------------------------

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    const receivedSignature =
      req.get("X-Signature") || "";

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "utf8"
    );

    const receivedBuffer = Buffer.from(
      receivedSignature,
      "utf8"
    );

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      console.warn(
        "[STEADFAST WEBHOOK] FAILED: Invalid X-Signature",
        {
          idempotencyKey,
          ip: req.ip,
          receivedSignatureLength:
            receivedSignature.length,
          processingTimeMs: Date.now() - startedAt,
        }
      );

      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // ---------------------------------------------------------
    // 5. Parse JSON AFTER authentication
    // ---------------------------------------------------------

    let parsedBody;

    try {
      parsedBody = JSON.parse(
        req.body.toString("utf8")
      );
    } catch (error) {
      console.warn(
        "[STEADFAST WEBHOOK] FAILED: Invalid JSON",
        {
          idempotencyKey,
          error: error.message,
        }
      );

      return res.status(400).json({
        success: false,
        message: "Invalid JSON format",
      });
    }

    // ---------------------------------------------------------
    // 6. Attach verified payload
    // ---------------------------------------------------------

    req.parsedBody = parsedBody;
    req.rawBody = req.body;

    console.log(
      "[STEADFAST WEBHOOK] VERIFIED",
      {
        idempotencyKey,
        notificationType:
          parsedBody.notification_type,
        consignmentId:
          parsedBody.consignment_id,
        invoice:
          parsedBody.invoice,
        processingTimeMs:
          Date.now() - startedAt,
      }
    );

    next();
  } catch (error) {
    console.error(
      "[STEADFAST WEBHOOK] VERIFICATION ERROR",
      {
        idempotencyKey,
        error: error.message,
        stack: error.stack,
      }
    );

    return res.status(500).json({
      success: false,
      message: "Webhook verification failed",
    });
  }
};

