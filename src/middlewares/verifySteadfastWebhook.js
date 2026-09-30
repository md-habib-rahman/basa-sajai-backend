import crypto from "node:crypto";

export const verifySteadfastWebhook = (req, res, next) => {
  try {
    // ---------------------------------------------------------
    // 1. Get webhook secret
    // ---------------------------------------------------------

    const secret = process.env.STEADFAST_WEBHOOK_SECRET;

    if (!secret) {
      console.error(
        "STEADFAST_WEBHOOK_SECRET is missing in environment variables.",
      );

      return res.status(500).json({
        success: false,
        message: "Webhook secret missing",
      });
    }

    // ---------------------------------------------------------
    // 2. Make sure express.raw() was used
    // ---------------------------------------------------------

    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      console.error(
        "Steadfast webhook body is not a Buffer. " +
          "Make sure express.raw({ type: 'application/json' }) " +
          "is used before this middleware.",
      );

      return res.status(400).json({
        success: false,
        message: "Invalid webhook body",
      });
    }

    // ---------------------------------------------------------
    // 3. Verify HMAC SHA-256 signature
    // ---------------------------------------------------------

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const receivedSignature = req.get("X-Signature") || "";

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(receivedSignature, "utf8");

    // timingSafeEqual() requires equal-length buffers
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      console.warn("Invalid Steadfast webhook signature");

      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // ---------------------------------------------------------
    // 4. Parse JSON AFTER signature verification
    // ---------------------------------------------------------

    let parsedBody;

    try {
      parsedBody = JSON.parse(rawBody.toString("utf8"));
    } catch (error) {
      console.error("Steadfast webhook JSON parse error:", error.message);

      return res.status(400).json({
        success: false,
        message: "Invalid JSON format",
      });
    }

    // ---------------------------------------------------------
    // 5. Make parsed payload available to controller
    // ---------------------------------------------------------

    req.parsedBody = parsedBody;

    // Keep raw body available if you need it later
    req.rawBody = rawBody;

    // ---------------------------------------------------------
    // 6. Continue to controller
    // ---------------------------------------------------------

    next();
  } catch (error) {
    console.error("Steadfast webhook verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook verification failed",
    });
  }
};
