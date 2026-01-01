export default function DataSourcesPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
          Data & Refresh
        </p>
        <h2 className="text-2xl font-semibold">Where Data Comes From</h2>
      </header>

      <div className="space-y-3 text-sm text-white/70">
        <p>
          Delta Sports AI does not pull stats or odds from the model&apos;s memory. It relies on a set of
          APIs that the app controls. When you ask for stats or odds, the assistant should route to
          these sources, not fabricate numbers.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-white">Scores & box scores:</span> ESPN scoreboard
            and summary endpoints for NBA, NFL, NHL, college football, and college basketball.
          </li>
          <li>
            <span className="font-medium text-white">Team & player stats:</span> ESPN and official
            league APIs, plus nflfastR for NFL advanced team metrics. Historical and season-level
            snapshots now pull from Sports Reference (NBA/CBB, NFL/CFB, MLB, NHL) when available.
          </li>
          <li>
            <span className="font-medium text-white">Odds & markets:</span> an external odds
            provider (SportsBettingDime) for spreads, totals, moneylines, splits, futures, and props.
          </li>
          <li>
            <span className="font-medium text-white">User data:</span> Supabase stores bets,
            bankroll snapshots, and custom models tied to your account.
          </li>
        </ul>
        <p>
          Live-score and detail views are refreshed on a short interval and use no-cache ESPN
          requests so that the score bugs and box score stay in sync. Odds snapshots are fetched
          on demand for each chat request that needs them.
        </p>
      </div>
    </div>
  )
}
