import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchTeamMarketOrderbooksSnapshot } from "@/lib/services/market-orderbooks";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeTeamKey } from "@/lib/identity/sport";

const sport = process.argv[2] || "basketball_ncaab";

const buildKey = (s: string, away?: string | null, home?: string | null) => {
  if (!away || !home) return null;
  return `${s}:${normalizeTeamKey(away)}@${normalizeTeamKey(home)}`;
};

async function main() {
  const snapshot = await fetchTeamMarketOrderbooksSnapshot({
    sportKey: sport as any,
    marketKey: "all",
    limit: 120,
    depth: 8,
    minSharpNotional: 2000,
    mode: "fast",
  });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("market_projections_cache" as any)
    .select("edges, updated_at")
    .eq("sport", sport)
    .single();

  if (error || !data) {
    console.log("cache error", (error as any)?.message || "none");
    return;
  }

  const edges = Array.isArray((data as any).edges) ? (data as any).edges : [];
  const map = new Map<string, any>();
  for (const item of snapshot.items) {
    const key = buildKey(item.sportKey, item.awayTeam, item.homeTeam);
    if (!key) continue;
    map.set(`${key}:${item.marketKey}`, item);
  }

  let spreadMatches = 0;
  let totalMatches = 0;
  let h2hMatches = 0;

  for (const edge of edges) {
    const key = buildKey(sport, edge?.awayTeam, edge?.homeTeam);
    if (!key) continue;
    if (map.has(`${key}:spreads`)) spreadMatches += 1;
    if (map.has(`${key}:totals`)) totalMatches += 1;
    if (map.has(`${key}:h2h`)) h2hMatches += 1;
  }

  console.log(`sport=${sport}`);
  console.log(`edges=${edges.length} orderbooks=${snapshot.items.length}`);
  console.log({ spreadMatches, totalMatches, h2hMatches });

  console.log("\nSample edges:");
  for (const edge of edges.slice(0, 12)) {
    const key = buildKey(sport, edge?.awayTeam, edge?.homeTeam);
    console.log(`- ${edge.awayTeam} @ ${edge.homeTeam} | key=${key}`);
  }

  console.log("\nSample orderbooks:");
  for (const item of snapshot.items.slice(0, 16)) {
    const key = buildKey(item.sportKey, item.awayTeam, item.homeTeam);
    console.log(`- [${item.marketKey}] ${item.awayTeam || "?"} @ ${item.homeTeam || "?"} | key=${key}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
