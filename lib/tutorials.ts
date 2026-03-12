// Tutorial content for each tool

export type TutorialSection = {
  title: string
  content: string
}

export type TutorialContent = {
  id: string
  title: string
  subtitle: string
  sections: TutorialSection[]
}

export const TUTORIALS: Record<string, TutorialContent> = {
  "sharp-projections": {
    id: "sharp-projections",
    title: "Sharp Projections",
    subtitle: "Your guide to profitable sports betting",
    sections: [
      {
        title: "When to Bet",
        content: `**The #1 rule: Only bet when you have an edge.**

-  **3%+ Edge**: These are your bread-and-butter plays. Bet these consistently.
-  **5%+ Edge**: Strong plays. Increase your bet size slightly.
-  **7%+ Edge**: Rare, high-value spots. Max confidence plays.
-  **Under 2% Edge**: Skip it. The juice eats your profit.

**Timing matters for profitability:**
-  Bet early in the day when lines are softest
-  Lines get sharper closer to game time as books adjust
-  If our projection matches the current line, the edge is gone--move on
-  Check back after major news (injuries, lineup changes) for new edges`,
      },
      {
        title: "How to Use This to Make Money",
        content: `**Your daily routine for profitability:**

1. **Check the board** - Sort by edge %. Focus only on 3%+ edges.
2. **Verify the line** - Open your sportsbook. Is the line still available?
3. **Shop for the best number** - Check multiple books. A half-point matters.
4. **Place the bet** - Don't hesitate. Edges disappear fast.
5. **Log it** - Track every bet. Review weekly.

**What makes this profitable:**
Our models average **+2.62% CLV** (closing line value). This means if you bet our projected side, you're consistently beating the closing line--the strongest predictor of long-term profit.

**Volume is key:** One bet won't make you rich. 10+ bets per day at 3%+ edge compounds into serious profit over months.`,
      },
      {
        title: "Bet Sizing for Maximum Profit",
        content: `**Use Kelly Criterion to size your bets optimally:**

| Edge | Bet Size | Example ($10k bankroll) |
|------|----------|------------------------|
| 3-4% | 1% of bankroll | $100 per bet |
| 5-6% | 1.5% of bankroll | $150 per bet |
| 7%+ | 2% of bankroll | $200 per bet |

**Why this works:**
-  Too small = leaving money on the table
-  Too big = one bad run wipes you out
-  Kelly optimizes growth while protecting your bankroll

**Golden rules:**
-  Never exceed 2% on any single bet
-  Flat bet (same amount) if you're unsure
-  If you hit a losing streak, don't chase--stick to the system`,
      },
      {
        title: "The Math Behind Your Profit",
        content: `**Here's exactly how you make money:**

At **-110 odds**, you need to win **52.4%** to break even.

Our projections hit at **~55%** (2.62% edge). Here's what that means:

**Per 100 bets at $100/bet:**
-  You win 55 bets -> +$5,000
-  You lose 45 bets -> -$4,950
-  **Net profit: +$50 per 100 bets**

**Scale it up:**
-  10 bets/day = 300 bets/month
-  300 bets x $0.50 profit/bet = **$150/month per $100 unit**
-  With a $10k bankroll ($100 units): **~$1,500/month expected**

**This is a long-term game.** You'll have losing days and losing weeks. Trust the math. Over 1,000+ bets, the edge plays out.`,
      },
    ],
  },

  "sharp-props": {
    id: "sharp-props",
    title: "Sharp Props",
    subtitle: "Use live prop order books to time sharper entries",
    sections: [
      {
        title: "What to Bet",
        content: `**Focus on props with real resting liquidity.**

-  **Big wall size**: Start with markets showing the largest notional walls.
-  **Clear side pressure**: Prefer books where one side has a dominant wall.
-  **Playable odds**: Compare sharp lean odds to your sportsbook line before entry.

**Timing framework:**
-  Check markets as liquidity builds pregame.
-  Re-check right before placing the bet to avoid stale reads.
-  If the wall disappears, treat that signal as gone.`,
      },
      {
        title: "How to Use The Orderbook",
        content: `**Use this workflow every slate:**

1. **Sort by wall size** to find markets with real conviction.
2. **Read the lean** (Over/Under) from the strongest displayed wall.
3. **Check your book's price** against the sharp lean odds.
4. **Confirm context** (injuries, minutes limits, weather, lineup updates).
5. **Place only when all signals agree** (orderbook + price + context).

**Why this works:**
Orderbook walls show where real size is waiting to trade. That gives you a live read on direction and price sensitivity before sportsbooks fully react.`,
      },
      {
        title: "Bet Sizing",
        content: `**Keep sizing conservative even with strong orderbook signals.**

| Setup quality | Bet size |
|---------------|----------|
| Moderate wall + fair price | 0.5% bankroll |
| Strong wall + clear lean edge | 0.75% bankroll |
| Very strong wall + best price | 1.0% bankroll |

**Rules:**
-  Cap single-prop exposure at **1% bankroll**.
-  Spread action across multiple independent props.
-  Skip marginal spots instead of forcing volume.`,
      },
      {
        title: "Execution Rules",
        content: `**Treat Sharp Props as an execution layer, not a blind pick feed.**

-  Use orderbook lean to choose direction.
-  Use sportsbook price to decide if the bet is worth taking.
-  Track closing value on every play to measure signal quality.
-  Review which wall profiles hold up best by sport and market type.

The edge comes from combining **live liquidity reads + disciplined price selection** over a large sample.`,
      },
    ],
  },

  "parlay-pro": {
    id: "parlay-pro",
    title: "Parlay Pro",
    subtitle: "Sportsbook EV parlays plus a correlation-aware builder",
    sections: [
      {
        title: "What the EV Parlays Tab Does",
        content: `**These are pregame, sportsbook-only EV parlays.**

- We only show tickets with **EV 3%+**.
- We avoid prediction markets and filter longshot legs (default **+500**, with higher caps available).
- Parlays are capped at **2-5 legs**.

**Best book shown** = the sportsbook offering the strongest parlay price across all legs.`,
      },
      {
        title: "Minimum Odds Required",
        content: `**We show the minimum parlay odds needed to stay +EV.**

- If you shop another book, you need **at least that minimum** for the ticket to remain 3%+ EV.
- If the best book is below the minimum, **skip** the parlay.`,
      },
      {
        title: "Build Your Own",
        content: `**Use the builder when you want to craft your own ticket.**

- Start with a strong edge, then add correlated legs.
- Keep it short and confirm the parlay stays +EV after correlation.
- The same leg-odds filter and 2-5 leg rules apply.`,
      },
    ],
  },

  "live-projections": {
    id: "live-projections",
    title: "Live Projections",
    subtitle: "Profit from in-game edges in real-time",
    sections: [
      {
        title: "How the Meter Works",
        content: `**We use ESPN win probability to build a live spread range.**

**What you see:**
-  ESPN win probability meter per game
-  A derived spread line (favored team)
-  A confidence range that tightens as time runs out

**Use it to spot:**
-  Books lagging behind a win-probability swing
-  Stale lines after timeouts or quarter breaks
-  Overreactions to short scoring runs`,
      },
      {
        title: "How to Profit from Live Betting",
        content: `**The profitable live betting approach:**

1. **Watch the game** - Context is everything. Don't blind bet.
2. **Wait for stale lines** - Timeouts and breaks = books sleeping
3. **Compare to projection** - Is the live line off from fair value?
4. **Bet FAST** - You have seconds, not minutes
5. **One bet per spot** - Don't chase, don't double down

**Best live spots:**
-  After a team goes on a 10-0 run (line overreacts)
-  Key player picks up 3rd foul (books underreact)
-  Halftime (books reset, sometimes poorly)
-  After a timeout in a close game

**Live spreads > live ML.** The juice on live ML is brutal.`,
      },
      {
        title: "Live Bet Sizing",
        content: `**Live is the highest variance. Size small.**

| Edge | Bet Size | Why |
|------|----------|-----|
| 5-6% | 0.5% of bankroll | Minimum viable edge |
| 7-8% | 0.75% of bankroll | Good spot |
| 9%+ | 1% of bankroll | Rare, max it |

**Never exceed 1% on any live bet.**

**Bankroll protection:**
-  Set a daily live loss limit (2% of bankroll max)
-  Don't chase live losses with bigger bets
-  Live is supplemental--not your core strategy`,
      },
      {
        title: "Expected Live Profit",
        content: `**Live betting adds upside but isn't your main income.**

With 6% average edge on live bets:

**Per 50 live bets at $75/bet:**
-  Total wagered: $3,750
-  Expected return: $3,975
-  **Net profit: +$225**

**Monthly projection (2 live bets/day):**
-  60 live bets/month
-  ~$270/month profit
-  With $10k bankroll: **~$400/month from live**

**The real value:** Live betting catches edges the pre-game market missed. It's your hedge when games don't go as projected.

**Combine all tools for max profit:**
-  Sharp Projections: ~$1,500/mo
-  Sharp Props: ~$680/mo
-  Line Shopping: ~$2,400/mo
-  Parlays: ~$300/mo
-  Live: ~$400/mo
-  **Total: ~$5,280/month on $10k bankroll**`,
      },
    ],
  },
  "bet-feed": {
    id: "bet-feed",
    title: "Bet Feed",
    subtitle: "Live market activity from prediction markets",
    sections: [
      {
        title: "How it works",
        content: `The bet feed streams large and fast trades as they hit the market.

- Shows real money moving markets, not opinions.
- Highlights price moves after size hits.
- Helps you see which games are attracting action.`,
      },
      {
        title: "How to use it to make money",
        content: `Use it as a timing and validation tool.

1. Watch for clusters on the same outcome.
2. Compare the price to your sportsbook.
3. If your book still has the number, act quickly.
4. If the price already moved, skip it.

The goal is to beat the closing line, not chase late steam.`,
      },
      {
        title: "Best practices",
        content: `- Focus on repeat signals, not single bets.
- Avoid live games unless you are actively live betting.
- Track one or two games at a time for clarity.
- Only bet when the price is still available at your book.`,
      },
    ],
  },
  "sharp-money": {
    id: "sharp-money",
    title: "Sharp Money",
    subtitle: "Verified sharp signals with best-book pricing",
    sections: [
      {
        title: "Signals and criteria",
        content: `Sharp Money is a short list of bets that trigger one or more signals.

- Big bet size, clusters, timing, divergence.
- Cross-market EV based on no-vig sportsbook consensus.
- A best book and price are required to act.

More signals means stronger confirmation, but price is still king.`,
      },
      {
        title: "How to bet the right book",
        content: `Always use the recommended book and odds.

1. Match the listed book and line.
2. If the price moved or the book is unavailable, skip it.
3. Do not assume the same edge exists at a worse price.

The edge is tied to the exact price, not just the side.`,
      },
      {
        title: "Sizing by edge",
        content: `Scale your bet size with the EV.

| EV Edge | Bet Size |
|--------|----------|
| 3-4% | 0.5u |
| 5-7% | 1.0u |
| 8%+ | 1.5u |

Sizing matters because small edges need volume, and large edges are rare.
Never exceed 2u on a single bet.`,
      },
    ],
  },
  "guide-navigation": {
    id: "guide-navigation",
    title: "Navigate Delta",
    subtitle: "Find the right tool in seconds",
    sections: [
      {
        title: "Navigation basics",
        content: `Use the top tool tabs to move between projections and research.

-  **Projections mode** = edges, line shopping, EV, and parlays
-  **Research mode** = sharp action, trends, and backtesting
-  Whale Detector and Bet Feed live in the main tool navigation`,
      },
      {
        title: "Start here",
        content: `Most users start in **Sharp Projections** and **Line Shopping**.

1. Open Sharp Projections for the best edges.
2. Jump to Line Shopping to confirm your best price.
3. Save a routine so you move faster each day.`,
      },
      {
        title: "Fast switching",
        content: `Use the mode toggle to change the entire tool set.

-  Projections mode = betting workflow
-  Research mode = context and explanation
-  Your mode stays set until you toggle again`,
      },
    ],
  },
  "guide-betting-flow": {
    id: "guide-betting-flow",
    title: "Use Delta to Bet",
    subtitle: "A simple daily betting workflow",
    sections: [
      {
        title: "Find the edge",
        content: `Start with **Sharp Projections** and sort by edge.

-  Focus on 3%+ edges
-  Prefer early lines before they move
-  Ignore low-edge spots`,
      },
      {
        title: "Shop the line",
        content: `Open **Line Shopping** next.

-  Confirm the best book and price
-  A half point or 10 cents matters
-  Only bet if the price is still available`,
      },
      {
        title: "Scale with EV",
          content: `Use **Parlay Pro** for higher-conviction spots.

-  Use EV as the final filter
-  Keep a simple bankroll rule
-  Track results weekly`,
      },
    ],
  },
  "guide-research-mode": {
    id: "guide-research-mode",
    title: "Research Mode",
    subtitle: "Explain why a side is sharp",
    sections: [
      {
        title: "Sharp Action",
        content: `Use **Sharp Action** to understand the reasoning behind movement.

-  See model vs market deltas
-  Read signal summaries
-  Spot why pros are leaning a side`,
      },
      {
        title: "Betting Trends",
        content: `Use **Betting Trends** to spot 30-day movement patterns.

-  Track average line shifts
-  Identify the biggest movers
-  Use it for market context`,
      },
      {
        title: "Backtesting",
        content: `Use **Backtesting** to simulate strategy performance.

-  Test a rule
-  Measure ROI and drawdown
-  Use results to refine your process`,
      },
    ],
  },
}







