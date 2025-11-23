export default function BankrollDocsPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
          Bankroll & Bets
        </p>
        <h2 className="text-2xl font-semibold">Tracking Your Action</h2>
      </header>

      <div className="space-y-3 text-sm text-white/70">
        <p>
          Delta AI tracks bets at the unit/dollar level so you can understand how your strategy
          behaves over time. It does not move money or place bets with sportsbooks.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Add bets with stake, odds, sport, and basic notes; the app will compute potential win
            and store the bet as pending.
          </li>
          <li>
            When you settle a bet as won/lost/push, the app logs net profit or loss and updates
            your bankroll snapshot for that day.
          </li>
          <li>
            Bankroll adjustments (deposits/withdrawals) are tracked separately from results so you
            can distinguish performance from cashflow.
          </li>
        </ul>
        <p>
          Use the chat to request summaries (e.g., performance by sport, bet type, or book), but
          remember the assistant should not tell you how much to stake on any specific bet.
        </p>
      </div>
    </div>
  )
}

