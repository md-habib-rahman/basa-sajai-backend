import crypto from "crypto";

const processedIdempotencyKeys = new Set();

export const verifySteadfastWebhook = (req, res, next) => {
  try {
    const token = process.env.STEADFAST_WEBHOOK_SECRET;

    if (!token) {
      console.error("STEADFAST_WEBHOOK_SECRET is missing in environment variables.");
      return res.status(500).json({ success: false, message: "Webhook secret missing" });
    }

    // 1. Authorization Header Check
    const authHeader = req.get("Authorization") || "";
    const [type, value] = authHeader.split(" ");
    if (type !== "Bearer" || value !== token) {
      return res.status(401).json({ success: false, message: "Invalid Bearer token" });
    }

    // 2. Idempotency Key Check
    const idempotencyKey = req.get("Idempotency-Key");
    if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
      return res.status(200).json({
        success: true,
        message: "Event already processed (Idempotent request)",
      });
    }

    // 3. Signature Check (using Buffer directly)
    const rawBodyBuffer = req.body;
    if (!rawBodyBuffer || !Buffer.isBuffer(rawBodyBuffer)) {
      return res.status(400).json({ success: false, message: "Missing body buffer" });
    }

    const expected = crypto
      .createHmac("sha256", token)
      .update(rawBodyBuffer)
      .digest("hex");

    const given = req.get("X-Signature") || "";

    if (
      given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
    ) {
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    // 4. Safe JSON Parsing (Prevents app crash on invalid JSON)
    try {
      req.parsedBody = JSON.parse(rawBodyBuffer.toString("utf8"));
    } catch (parseErr) {
      console.error("Webhook Body JSON Parse Error:", parseErr.message);
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format in raw body",
      });
    }

    // Mark idempotency key as processed
    if (idempotencyKey) {
      processedIdempotencyKeys.add(idempotencyKey);
      setTimeout(() => processedIdempotencyKeys.delete(idempotencyKey), 86400000);
    }

    next();
  } catch (err) {
    console.error("Webhook Verification Error:", err);
    return res.status(400).json({ success: false, message: "Webhook verification failed" });
  }
};