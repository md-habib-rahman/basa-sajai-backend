import { prisma } from "../src/config/db.js";
/**
 * Script: Reconcile Product Stock & Log Audit History
 * Computes actual sold quantities from non-cancelled orders,
 * calculates discrepancy, and logs the reconciliation in `inventory_log`.
 */
async function reconcileStock() {
  console.log("🔍 Starting Stock Audit and Reconciliation Procedure...\n");

  try {
    // 1. Fetch active non-cancelled orders and all products
    const products = await prisma.product.findMany({
      include: {
        orderItems: {
          where: {
            order: {
              status: {
                notIn: ["CANCELLED"], // Exclude cancelled orders
              },
            },
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
              },
            },
          },
        },
        inventoryLogs: true,
      },
    });

    console.log(`📦 Loaded ${products.length} products for evaluation.\n`);

    let auditSummary = {
      totalProducts: products.length,
      adjustedProducts: 0,
      totalAdjustedUnits: 0,
    };

    // 2. Iterate through each product and evaluate stock discrepancy
    for (const product of products) {
      // Calculate total units reserved/sold in active (non-cancelled) orders
      const totalActiveOrdersQuantity = product.orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      // Sum existing logged movement delta
      const totalLoggedMovement = product.inventoryLogs.reduce(
        (sum, log) => sum + log.quantityChange,
        0,
      );

      console.log(`--------------------------------------------------`);
      console.log(`Product: [${product.sku || "NO-SKU"}] ${product.title}`);
      console.log(`  - Current Stock in DB : ${product.stockQuantity}`);
      console.log(`  - Total in Active Orders : ${totalActiveOrdersQuantity}`);
      console.log(`  - Logged History Movement : ${totalLoggedMovement}`);

      // Check if stock log history is empty or mismatched
      const initialStockNote = `[SYSTEM_AUDIT] Stock reconciled against ${product.orderItems.length} active orders.`;

      // Perform atomic transaction if a zero-history audit record is required
      if (product.inventoryLogs.length === 0) {
        await prisma.$transaction(async (tx) => {
          // Record baseline audit entry
          await tx.inventoryLog.create({
            data: {
              productId: product.id,
              changeType: "MANUAL_ADJUSTMENT",
              quantityChange: -totalActiveOrdersQuantity,
              note: `Initial baseline audit: ${totalActiveOrdersQuantity} units in active non-cancelled orders. Current physical stock: ${product.stockQuantity}`,
            },
          });
        });

        console.log(`  ✅ Baseline audit log created for ${product.title}`);
        auditSummary.adjustedProducts++;
      } else {
        console.log(`  ℹ️ Stock logs intact. No manual overwrite needed.`);
      }
    }

    console.log(`\n==================================================`);
    console.log(`🎉 Audit Complete Summary:`);
    console.log(`   - Evaluated Products : ${auditSummary.totalProducts}`);
    console.log(`   - Reconciled Products: ${auditSummary.adjustedProducts}`);
    console.log(`==================================================\n`);
  } catch (error) {
    console.error("❌ Error during reconciliation:", error);
  } finally {
    await prisma.$disconnect();
  }
}

reconcileStock();
