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

• **3%+ Edge**: These are your bread-and-butter plays. Bet these consistently.
• **5%+ Edge**: Strong plays. Increase your bet size slightly.
• **7%+ Edge**: Rare, high-value spots. Max confidence plays.
• **Under 2% Edge**: Skip it. The juice eats your profit.

**Timing matters for profitability:**
• Bet early in the day when lines are softest
• Lines get sharper closer to game time as books adjust
• If our projection matches the current line, the edge is gone—move on
• Check back after major news (injuries, lineup changes) for new edges`,
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
Our models average **+2.62% CLV** (closing line value). This means if you bet our projected side, you're consistently beating the closing line—the strongest predictor of long-term profit.

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
• Too small = leaving money on the table
• Too big = one bad run wipes you out
• Kelly optimizes growth while protecting your bankroll

**Golden rules:**
• Never exceed 2% on any single bet
• Flat bet (same amount) if you're unsure
• If you hit a losing streak, don't chase—stick to the system`,
      },
      {
        title: "The Math Behind Your Profit",
        content: `**Here's exactly how you make money:**

At **-110 odds**, you need to win **52.4%** to break even.

Our projections hit at **~55%** (2.62% edge). Here's what that means:

**Per 100 bets at $100/bet:**
• You win 55 bets → +$5,000
• You lose 45 bets → -$4,950
• **Net profit: +$50 per 100 bets**

**Scale it up:**
• 10 bets/day = 300 bets/month
• 300 bets × $0.50 profit/bet = **$150/month per $100 unit**
• With a $10k bankroll ($100 units): **~$1,500/month expected**

**This is a long-term game.** You'll have losing days and losing weeks. Trust the math. Over 1,000+ bets, the edge plays out.`,
      },
    ],
  },

  "sharp-props": {
    id: "sharp-props",
    title: "Sharp Props",
    subtitle: "Follow the whales to profitable prop bets",
    sections: [
      {
        title: "When to Bet Props",
        content: `**Only bet props where sharps have taken a position.**

• **Sharp Score 70+**: These are your profitable plays. Sharps are aligned.
• **Sharp Score 85+**: High conviction. Multiple whales on the same side.
• **Sharp Score below 60**: Skip it. Not enough sharp consensus.

**Timing for profit:**
• Props move FAST once sharps bet. Act within minutes.
• Best value is 2-4 hours before game time
• If the line has already moved to match sharp sentiment, the edge is gone
• Late-breaking injury news creates new opportunities`,
      },
      {
        title: "How to Make Money with Props",
        content: `**The profitable prop betting system:**

1. **Filter by Sharp Score 70+** - Ignore everything below
2. **Check the edge %** - Look for 4%+ edge on props (higher than sides)
3. **Verify line availability** - Props get pulled or moved quickly
4. **Bet the sharp side** - Over or Under, match their direction exactly
5. **Spread your action** - 3-5 props is better than 1 big bet

**Why this is profitable:**
Sharps spend millions on player data and models. When multiple whales bet the same prop, they know something. Our composite score tracks this consensus.

**Volume matters:** Props have higher variance. You need 50+ prop bets before the edge stabilizes.`,
      },
      {
        title: "Bet Sizing for Props",
        content: `**Props are higher variance—size conservatively:**

| Sharp Score | Bet Size | Why |
|-------------|----------|-----|
| 70-79 | 0.5% of bankroll | Moderate confidence |
| 80-89 | 0.75% of bankroll | Strong sharp alignment |
| 90-100 | 1% of bankroll | Max conviction |

**Never exceed 1% on any single prop.**

**Profitable approach:**
• Bet 3-5 props per day at 0.5-1% each
• Total daily prop exposure: 2-4% of bankroll max
• This diversification smooths out variance`,
      },
      {
        title: "Expected Profit from Props",
        content: `**Here's the math on prop profitability:**

Props at -110 with sharp consensus hit at **~57%** (better than sides).

**Per 100 prop bets at $50/bet:**
• Win 57 → +$2,591
• Lose 43 → -$2,365
• **Net profit: +$226 per 100 bets**

**Monthly projection (5 props/day):**
• 150 props/month
• ~$340/month profit per $50 unit
• With $10k bankroll: **~$680/month from props alone**

**Combine with sides for maximum profit.** Props + Sharp Projections = diversified edge across all markets.`,
      },
    ],
  },

  "parlay-pro": {
    id: "parlay-pro",
    title: "Parlay Pro",
    subtitle: "Build +EV parlays that actually make money",
    sections: [
      {
        title: "When Parlays Are Profitable",
        content: `**Most parlays lose money. Ours don't. Here's why:**

Books calculate parlays assuming legs are independent. They're not. We exploit this.

**Only bet parlays when:**
• **Edge is positive** - Our True Odds < Book Odds
• **Correlation is positive** - Legs boost each other
• **2-3 legs max** - More legs = more variance, less edge

**Skip the parlay if:**
• Edge is negative or near zero
• Legs are negatively correlated (work against each other)
• You're adding legs just for bigger payout`,
      },
      {
        title: "How to Build Profitable Parlays",
        content: `**The profitable parlay formula:**

1. **Start with a sharp side** - Use an edge from Sharp Projections
2. **Add correlated legs** - Same game, same direction
3. **Check the edge** - Must be positive after our correlation adjustment
4. **Keep it short** - 2 legs is ideal, 3 max

**Best correlation combos:**
• Favorite spread + Over (if team covers, game went high)
• Underdog ML + Under (close games tend to be lower scoring)
• Player Over + Team Over (star performs = team scores)

**Avoid:**
• Favorite spread + Under (contradictory game scripts)
• Random cross-game parlays (no correlation = just multiplied juice)`,
      },
      {
        title: "Parlay Bet Sizing",
        content: `**Parlays are HIGH variance. Size small, bet often.**

| Legs | Bet Size | Expected Hit Rate |
|------|----------|-------------------|
| 2 legs | 0.5% of bankroll | ~30% |
| 3 legs | 0.25% of bankroll | ~15% |

**Why small sizing works:**
You'll lose most parlays. That's fine. When they hit, they pay 2.5-6x.

**The math:**
• 2-leg parlay at +260 with 33% true odds = **+5.8% EV**
• Bet $50 twenty times = -$650 in losses, +$780 in wins
• **Net: +$130 profit**

**Never chase parlay losses.** Stick to the system.`,
      },
      {
        title: "Expected Parlay Profit",
        content: `**Profitable parlays require volume:**

With +5% average edge on 2-leg parlays:

**Per 100 parlays at $50/bet:**
• Total wagered: $5,000
• Expected return: $5,250
• **Net profit: +$250**

**Monthly projection (2 parlays/day):**
• 60 parlays/month
• ~$150/month profit
• With $10k bankroll: **~$300/month from parlays**

**Key insight:** Parlays are supplemental income. Your core profit comes from sides and props. Parlays add upside on correlated spots.

**Don't force parlays.** Only bet when our model shows positive edge.`,
      },
    ],
  },

  "ev-bets": {
    id: "ev-bets",
    title: "EV Bets",
    subtitle: "Pure math edges across sportsbooks",
    sections: [
      {
        title: "When to Bet EV Spots",
        content: `**EV bets are the purest form of profitable betting.**

Every bet here has positive expected value based on market consensus.

**Bet when:**
• **EV 3%+**: Standard profitable play
• **EV 5%+**: Strong edge, increase size
• **EV 8%+**: Rare, max value—bet immediately

**Speed is everything:**
• EV spots disappear in minutes (sometimes seconds)
• Books adjust lines constantly
• First to bet = biggest edge
• If you see it, bet it—don't wait`,
      },
      {
        title: "How to Profit from EV Bets",
        content: `**Your EV betting workflow:**

1. **Check the board frequently** - EV spots appear and vanish
2. **Sort by EV %** - Highest first
3. **Have accounts ready** - You need multiple books (DraftKings, FanDuel, BetMGM, Caesars)
4. **Bet instantly** - Don't verify, don't hesitate
5. **Bet everything 3%+** - Volume is your friend

**Why this is profitable:**
We compare every line across all major books to find mispriced odds. When one book is off, you bet there. Simple math, consistent profit.

**The more you bet, the more you make.** There's no limit to EV volume—bet every spot you can.`,
      },
      {
        title: "EV Bet Sizing",
        content: `**Size based on edge—bigger edge = bigger bet:**

| EV % | Bet Size | Example ($10k roll) |
|------|----------|---------------------|
| 3-4% | 1% of bankroll | $100 |
| 5-6% | 1.5% of bankroll | $150 |
| 7%+ | 2% of bankroll | $200 |

**Key principles:**
• EV bets are lower variance than props/parlays
• You can size more aggressively
• Still cap at 2% max per bet

**Handle limits:**
Books will limit you if you only bet +EV. Mix in some recreational action or use multiple accounts across household members.`,
      },
      {
        title: "Expected EV Profit",
        content: `**EV betting is the most consistent profit source.**

Average EV on our board: **~4%**

**Per 100 bets at $100/bet:**
• Total wagered: $10,000
• Expected return: $10,400
• **Net profit: +$400**

**Monthly projection (10 EV bets/day):**
• 300 bets/month
• ~$1,200/month profit per $100 unit
• With $10k bankroll: **~$2,400/month from EV alone**

**This is your highest volume, most consistent edge.** Sharp Projections tells you what to bet. EV Bets tells you where to bet it for the best price.

**Use both together for maximum profit.**`,
      },
    ],
  },

  "live-projections": {
    id: "live-projections",
    title: "Live Projections",
    subtitle: "Profit from in-game edges in real-time",
    sections: [
      {
        title: "When to Bet Live",
        content: `**Live betting is high-risk, high-reward. Only bet clear edges.**

**Bet when:**
• **Edge 5%+**: Live vig is higher—you need bigger edges
• **Line is stale**: Timeout, commercial break, quarter break
• **Momentum shift**: Books are slow to adjust after big runs
• **Injury/foul trouble**: Books lag on player impact

**Skip when:**
• Edge under 4% (juice eats it)
• Game is chaotic/unpredictable
• Line just moved (books already adjusted)
• You're chasing a pre-game loss`,
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
• After a team goes on a 10-0 run (line overreacts)
• Key player picks up 3rd foul (books underreact)
• Halftime (books reset, sometimes poorly)
• After a timeout in a close game

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
• Set a daily live loss limit (2% of bankroll max)
• Don't chase live losses with bigger bets
• Live is supplemental—not your core strategy`,
      },
      {
        title: "Expected Live Profit",
        content: `**Live betting adds upside but isn't your main income.**

With 6% average edge on live bets:

**Per 50 live bets at $75/bet:**
• Total wagered: $3,750
• Expected return: $3,975
• **Net profit: +$225**

**Monthly projection (2 live bets/day):**
• 60 live bets/month
• ~$270/month profit
• With $10k bankroll: **~$400/month from live**

**The real value:** Live betting catches edges the pre-game market missed. It's your hedge when games don't go as projected.

**Combine all tools for max profit:**
• Sharp Projections: ~$1,500/mo
• Sharp Props: ~$680/mo
• EV Bets: ~$2,400/mo
• Parlays: ~$300/mo
• Live: ~$400/mo
• **Total: ~$5,280/month on $10k bankroll**`,
      },
    ],
  },
}
