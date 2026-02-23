import { config } from "dotenv";
config({ path: ".env.local" });

import { getPropOrderbooksCache } from "@/lib/services/prop-orderbooks-cache";

const keys = [
  "market-orderbooks:sport:basketball_nba:market:all:depth:8:min:2000",
  "market-orderbooks:sport:basketball_ncaab:market:all:depth:8:min:2000",
  "market-orderbooks:sport:americanfootball_nfl:market:all:depth:8:min:2000",
  "market-orderbooks:sport:icehockey_nhl:market:all:depth:8:min:2000",
  "market-orderbooks:sport:all:market:all:depth:8:min:2000",
];

async function run() {
  for (const key of keys) {
    const row = await getPropOrderbooksCache(key);
    const payload = row?.payload as any;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    console.log(`\nKEY: ${key}`);
    console.log(`fetched_at=${row?.fetched_at || "null"} updatedAt=${payload?.updatedAt || "null"} items=${items.length}`);
    for (const item of items.slice(0, 8)) {
      console.log(`- [${item.marketKey}] ${item.awayTeam || "?"} @ ${item.homeTeam || "?"} | ticker=${item.ticker || "?"} | liquidity=${item.sharpLiquidityNotional ?? 0}`);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
