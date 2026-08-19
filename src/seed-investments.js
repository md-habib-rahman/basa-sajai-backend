import { prisma } from "./config/db.js";

const initialData = [
  {
    date: "2026-07-23",
    desc: "Move on Purchase",
    purchaser: "JOINT",
    total: 12713,
    habib: 6353,
    robiul: 6360,
  },
  {
    date: "2026-08-02",
    desc: "Ad Cost",
    purchaser: "ROBIUL",
    total: 844,
    habib: 0,
    robiul: 844,
  },
  {
    date: "2026-08-02",
    desc: "Tripod",
    purchaser: "JOINT",
    total: 2000,
    habib: 1900,
    robiul: 100,
  },
  {
    date: "2026-08-02",
    desc: "Mat",
    purchaser: "ROBIUL",
    total: 880,
    habib: 0,
    robiul: 880,
  },
  {
    date: "2026-08-03",
    desc: "Ad Cost",
    purchaser: "ROBIUL",
    total: 850,
    habib: 0,
    robiul: 850,
  },
  {
    date: "2026-08-09",
    desc: "Group membership",
    purchaser: "ROBIUL",
    total: 400,
    habib: 0,
    robiul: 400,
  },
  {
    date: "2026-08-08",
    desc: "Business Explore- Midford",
    purchaser: "HABIB",
    total: 1120,
    habib: 1120,
    robiul: 0,
  },
  {
    date: "2026-08-11",
    desc: "Bubble wrap",
    purchaser: "HABIB",
    total: 214,
    habib: 214,
    robiul: 0,
  },
  {
    date: "2026-08-11",
    desc: "Tape+sticker paper",
    purchaser: "HABIB",
    total: 220,
    habib: 220,
    robiul: 0,
  },
  {
    date: "2026-08-11",
    desc: "Bubble wrap",
    purchaser: "ROBIUL",
    total: 414,
    habib: 0,
    robiul: 414,
  },
  {
    date: "2026-08-11",
    desc: "Tape",
    purchaser: "ROBIUL",
    total: 220,
    habib: 0,
    robiul: 220,
  },
  {
    date: "2026-08-13",
    desc: "Bohemian Bati Local Source",
    purchaser: "JOINT",
    total: 16300,
    habib: 15000,
    robiul: 1300,
  },
  {
    date: "2026-08-13",
    desc: "Moveon Product due",
    purchaser: "ROBIUL",
    total: 10849,
    habib: 0,
    robiul: 10849,
  },
  {
    date: "2026-08-14",
    desc: "CNG+Riska",
    purchaser: "ROBIUL",
    total: 330,
    habib: 0,
    robiul: 330,
  },
  {
    date: "2026-08-13",
    desc: "Anti Cutter, Rope, Marker",
    purchaser: "ROBIUL",
    total: 90,
    habib: 0,
    robiul: 90,
  },
  {
    date: "2026-08-13",
    desc: "Fish bait partial payment",
    purchaser: "ROBIUL",
    total: 697,
    habib: 0,
    robiul: 697,
  },
  {
    date: "2026-08-14",
    desc: "RMB Buy-695.607",
    purchaser: "HABIB",
    total: 13310,
    habib: 13310,
    robiul: 0,
  },
  {
    date: "2026-08-15",
    desc: "RMB Payment 74",
    purchaser: "ROBIUL",
    total: 1400,
    habib: 0,
    robiul: 1400,
  },
];

async function seed() {
  console.log("Seeding investment data...");
  for (const item of initialData) {
    await prisma.investment.create({
      data: {
        investmentDate: new Date(item.date),
        description: item.desc,
        purchaser: item.purchaser,
        totalCost: item.total,
        habibContribution: item.habib,
        robiulContribution: item.robiul,
      },
    });
  }
  console.log("✅ Investment ledger seeded successfully!");
  process.exit(0);
}

seed();
