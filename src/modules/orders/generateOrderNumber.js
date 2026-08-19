import { prisma } from "../../config/db.js";

export const generateOrderNumber = async () => {
  const now = new Date();
  // Formats to YYYYMMDD (e.g., 20260819)
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `BS-${datePart}-`;

  // Query the latest order matching today's date prefix
  const latestOrder = await prisma.order.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: "desc",
    },
    select: {
      orderNumber: true,
    },
  });

  let sequence = 1;

  if (latestOrder) {
    const parts = latestOrder.orderNumber.split("-");
    const lastSequence = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
};
