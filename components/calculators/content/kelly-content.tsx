import Link from "next/link"

export default function KellyContent() {
  return (
    <div className="mt-10 space-y-10 text-white/80">
      <section>
        <h2 className="text-2xl font-semibold text-white">How to use the Kelly Criterion calculator</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            Enter your <strong>honest</strong> estimate of the true win probability — not the
            sportsbook's implied probability. If you think a -110 spread should actually close at
            -130, your estimated probability is ~56.5%, not 52.4%.
          </li>
          <li>Enter the American odds you're being offered right now.</li>
          <li>Enter your full bankroll (the number you're willing to go to zero with, not your net worth).</li>
          <li>
            Choose a Kelly fraction. <strong>Full Kelly is too aggressive for almost everyone.</strong>{" "}
            Sharp bettors typically use 0.25 (quarter Kelly) because probability estimates are
            noisy and full Kelly amplifies estimation error into ruinous drawdowns.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white">The Kelly formula</h2>
        <p className="mt-3 text-sm leading-relaxed">
          For a binary bet at decimal odds <code className="rounded bg-white/10 px-1">d</code> with
          win probability <code className="rounded bg-white/10 px-1">p</code>:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-emerald-200">
{`f* = (bp - q) / b

where:
  b = d - 1       (net decimal odds; profit per $1 staked)
  p = win probability
  q = 1 - p       (loss probability)
  f* = fraction of bankroll to stake`}
        </pre>
        <p className="mt-3 text-sm leading-relaxed">
          If <code className="rounded bg-white/10 px-1">f*</code> is negative, the formula is
          telling you not to bet — your estimated edge is below the vig. Positive values are the
          Kelly-optimal stake under the assumption that your probability estimate is exactly right.
          It almost never is, which is why fractional Kelly exists.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white">Worked example</h2>
        <p className="mt-3 text-sm leading-relaxed">
          The Chiefs are -150 to beat the Raiders on Sunday. Your model (or the sharp-money signal
          in Delta) tells you the fair line is -200, which corresponds to a 66.7% win probability.
          Your bankroll is $2,000.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>American -150 = decimal 1.667, so <code className="rounded bg-white/10 px-1">b = 0.667</code></li>
          <li><code className="rounded bg-white/10 px-1">p = 0.667</code>, <code className="rounded bg-white/10 px-1">q = 0.333</code></li>
          <li>f* = (0.667 × 0.667 − 0.333) / 0.667 = 0.166 → <strong>16.6% of bankroll</strong></li>
          <li>Full Kelly stake: $332. Quarter Kelly stake: $83.</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed">
          Notice how aggressive even a correctly-estimated edge gets at full Kelly. If your
          probability estimate is off by just a few points, full Kelly can easily suggest staking
          30%+ of your roll — and a five-bet cold streak at that size can halve your bankroll.
          Quarter Kelly gives you most of the long-run growth with a fraction of the variance.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white">When sharp bettors actually use Kelly</h2>
        <p className="mt-3 text-sm leading-relaxed">
          Pros don't run Kelly on gut-feel win probabilities. They use it when they have a{" "}
          <strong>calibrated probability model</strong> — a bottom-up projection, a no-vig line
          from sharp books, or a sharp-money signal showing where limits are absorbing real money.
          Three common applications:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            <strong>Sizing off a no-vig fair line.</strong> Devig the best market (usually Pinnacle
            or Circa), compare to the price you can get at a softer book, and stake quarter Kelly
            on the gap.
          </li>
          <li>
            <strong>Sizing off a sharp-money signal.</strong> When Delta flags a whale trade on an
            exchange, the implied probability of that bet (sized against depth of book) becomes
            your <code className="rounded bg-white/10 px-1">p</code>.
          </li>
          <li>
            <strong>Sizing off a model.</strong> If your NFL power ratings say KC -3, and the line
            is KC -1.5, you have a 1.5-point edge. Convert to probability using a push chart, then
            Kelly.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white">Common mistakes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            <strong>Using full Kelly.</strong> Full Kelly maximizes log-growth but assumes perfect
            probabilities. Real-world estimates are noisy; fractional Kelly is the practical answer.
          </li>
          <li>
            <strong>Recomputing bankroll after every bet.</strong> This works in theory but
            amplifies variance after losses (you bet smaller when you're down, so recovering takes
            longer). Most pros reset bankroll weekly or monthly.
          </li>
          <li>
            <strong>Kelly on correlated bets.</strong> Kelly assumes each bet is independent. Two
            same-game parlays on the same team are basically one bet — stake as if it's one bet.
          </li>
          <li>
            <strong>Ignoring bet limits.</strong> If Kelly says $1,500 but the book will only take
            $400, you're not getting Kelly sizing — you're getting max-bet sizing. Shop lines.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white">Related tools</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <li><Link className="text-emerald-300 hover:text-emerald-200" href="/calculators">All calculators</Link></li>
          <li><Link className="text-emerald-300 hover:text-emerald-200" href="/market-projections">Sharp line movement tracker</Link></li>
          <li><Link className="text-emerald-300 hover:text-emerald-200" href="/sharp-betting-tools">Sharp betting tools overview</Link></li>
          <li><Link className="text-emerald-300 hover:text-emerald-200" href="/ev-bets">Live EV bets</Link></li>
        </ul>
      </section>

      <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/5 p-6">
        <h2 className="text-xl font-semibold text-white">Delta sizes every flagged bet with Kelly</h2>
        <p className="mt-2 text-sm leading-relaxed">
          When Delta detects a whale trade or a sharp Pinnacle move, it computes a fair probability
          from the market — not a guess — and shows you the quarter-Kelly stake against your
          bankroll. Set it once; every alert arrives pre-sized.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-flex items-center rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-300"
        >
          Start 7-day trial →
        </Link>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-white">FAQ</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed">
          <div>
            <h3 className="font-semibold text-white">What Kelly fraction should I use?</h3>
            <p className="mt-1">
              Quarter Kelly (0.25) is the sharp-bettor default. It gives you roughly 75% of full
              Kelly's long-run growth rate with ~40% of the variance. Use 0.1 if you're brand-new
              to probability estimation; use 0.5 only if you have a proven track record.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Does Kelly work for parlays?</h3>
            <p className="mt-1">
              Yes, but use the combined decimal odds and the combined (multiplied) win probability.
              Because the variance of parlays is much higher, stick to quarter Kelly or less.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Why is my Kelly stake negative?</h3>
            <p className="mt-1">
              Your estimated probability is lower than the book's implied probability after vig.
              The formula is correctly telling you not to bet.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">Should I update bankroll between bets?</h3>
            <p className="mt-1">
              Most pros don't. They set a bankroll at the start of a week or month and Kelly-size
              against that fixed number, then re-anchor on the review date. Continuously updating
              amplifies variance after losing streaks.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export const kellyFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What Kelly fraction should I use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Quarter Kelly (0.25) is the sharp-bettor default. It gives you roughly 75% of full Kelly's long-run growth rate with ~40% of the variance.",
      },
    },
    {
      "@type": "Question",
      name: "Does Kelly work for parlays?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — use combined decimal odds and combined win probability. Because parlay variance is higher, stick to quarter Kelly or less.",
      },
    },
    {
      "@type": "Question",
      name: "Why is my Kelly stake negative?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your estimated probability is below the book's implied probability after vig. The formula is correctly telling you not to bet.",
      },
    },
    {
      "@type": "Question",
      name: "Should I update bankroll between bets?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most pros don't. They set bankroll at the start of a week or month and Kelly-size against that fixed number, re-anchoring on the review date.",
      },
    },
  ],
}
