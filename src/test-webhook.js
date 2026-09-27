import crypto from "crypto";

const TOKEN = "XXwKI_Qy_iGRwV8czhBY6VqUjNtG1XRACEA9oxr3_2Y";
const PORT = 5000;

const payloadObj = {
  consignment_id: 1029384,
  invoice: "BS-20260920-0002",
  cod_amount: 3730,
  delivery_charge: 80,
  status: "delivered",
};

// Exact unparsed raw string sent over the wire
const rawBodyString = JSON.stringify(payloadObj);

// Compute HMAC-SHA256 matching express.raw() verification
const signature = crypto
  .createHmac("sha256", TOKEN)
  .update(rawBodyString)
  .digest("hex");

const idempotencyKey = `test-evt-${Date.now()}`;

console.log("=== WINDOWS CMD cURL ===");
console.log(
  `curl -X POST http://localhost:${PORT}/api/courier/webhook -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" -H "X-Signature: ${signature}" -H "Idempotency-Key: ${idempotencyKey}" -d "${rawBodyString.replace(/"/g, '\\"')}"`
);

console.log("\n=== GIT BASH / LINUX / MACOS cURL ===");
console.log(
  `curl -X POST http://localhost:${PORT}/api/courier/webhook \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${TOKEN}" \\\n  -H "X-Signature: ${signature}" \\\n  -H "Idempotency-Key: ${idempotencyKey}" \\\n  -d '${rawBodyString}'`
);