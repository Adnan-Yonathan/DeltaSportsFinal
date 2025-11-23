export default function DocsOverviewPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
          Overview
        </p>
        <h2 className="text-2xl font-semibold">What Delta AI Does</h2>
        <p className="text-sm text-white/60">
          Delta AI is a sports betting assistant that turns live odds, ESPN stats, and your own
          questions into clear, grounded analysis. It is not a pick service and never guarantees
          outcomes.
        </p>
      </header>

      <div className="space-y-3 text-sm text-white/70">
        <p>
          The app focuses on helping you understand why lines look the way they do, what actually
          impacts a matchup, and how your bankroll is performing over time. It keeps the heavy
          lifting on data, not vibes.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Live scores and box scores for major US sports</li>
          <li>Odds and markets via an external odds API</li>
          <li>Team and player stats pulled from ESPN and other league feeds</li>
          <li>Chat tools that can analyze games, articles, and models</li>
          <li>Bankroll tracking and bet history stored in your account</li>
        </ul>
        <p className="text-xs text-white/40">
          Last updated: {new Date().toISOString().slice(0, 10)}
        </p>
      </div>
    </div>
  )
}

