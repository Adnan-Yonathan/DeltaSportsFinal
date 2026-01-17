export type ToolContent = {
  id: string
  label: string
  route: string
  icon: string
  summary: string
  description: string
  howToUse: string
  unique: string
  useCases: string[]
}

export const TOOLS_CONTENT: ToolContent[] = [
  {
    id: "sharp-projections",
    label: "Sharp Projections",
    route: "/market-projections",
    icon: "line-chart",
    summary:
      "Market-level projections that translate model signals into fair prices, confidence, and edge.",
    description:
      "Sharp Projections turns raw modeling into actionable market prices, showing where listed lines diverge from fair value. It layers confidence, market movement, and implied probability so you can see the strongest edges without guessing.",
    howToUse:
      "Choose a sport and slate, sort by edge or confidence, and open matchups to compare fair price vs market price. Focus on lines that stay positive across books, then track movement to time entries.",
    unique:
      "Instead of just showing projections, it ties the projection to the actual market price and highlights the exact gap. You are always comparing value, not just performance.",
    useCases: [
      "Early slate hunting before lines move.",
      "Cross-book price shopping for the best edge.",
      "Validating market confidence before placing a bet.",
    ],
  },
  {
    id: "sharp-props",
    label: "Sharp Props",
    route: "/player-projections",
    icon: "target",
    summary:
      "Player prop projections with matchup context, usage rates, and probability splits.",
    description:
      "Sharp Props focuses on player markets, blending projections with opponent tendencies, usage trends, and form. It flags props that are lagging behind recent performance or matchup dynamics.",
    howToUse:
      "Filter by sport or player, compare the projection to the listed line, and review context notes for matchup or role changes. Prioritize props with stable edges across multiple books.",
    unique:
      "It is built around player-specific signals instead of generic averages, so the projections adapt to usage, pace, and opponent style.",
    useCases: [
      "Finding mispriced lines before public news moves them.",
      "Building prop ladders from stable projection gaps.",
      "Stacking correlated props around the same game script.",
    ],
  },
  {
    id: "parlay-pro",
    label: "Parlay Pro",
    route: "/parlay-predictor",
    icon: "layers",
    summary:
      "Parlay construction focused on probability, correlation, and payout efficiency.",
    description:
      "Parlay Pro helps you build multi-leg tickets with clear probability math, avoiding hidden negative EV combos. It checks how each leg impacts the combined win probability and payout fairness.",
    howToUse:
      "Start with one strong edge, add legs that align with the same game script, and compare the implied payout to the model probability. Remove legs that dilute the parlay or introduce negative correlation.",
    unique:
      "It highlights correlation and payout efficiency, not just whether a leg looks likely. This keeps parlays grounded in real expected value.",
    useCases: [
      "Building 2-4 leg parlays with verified edges.",
      "Testing alternate legs before locking a ticket.",
      "Checking if a payout is actually fair for the risk.",
    ],
  },
  {
    id: "ev-bets",
    label: "EV Bets",
    route: "/ev-bets",
    icon: "percent",
    summary:
      "Expected value scanner that highlights mispriced lines across markets and books.",
    description:
      "EV Bets surfaces the highest value lines right now by comparing market odds to fair probability. It is the fastest way to see where the biggest edges exist at the moment.",
    howToUse:
      "Filter by sport or market, sort by EV, and use the best price column to select the book. Track when an edge narrows to avoid late entries.",
    unique:
      "It is price-first, so it finds value even when a matchup feels obvious. The edge is grounded in math, not hype.",
    useCases: [
      "Daily edge hunting across multiple markets.",
      "Quick lists of high-EV bets for a slate.",
      "Monitoring when lines cross into positive EV.",
    ],
  },
  {
    id: "live-projections",
    label: "Live Projections",
    route: "/live-projections",
    icon: "activity",
    summary:
      "In-game projection updates as new play-by-play data arrives.",
    description:
      "Live Projections updates win probability and totals in real time, reacting to pace, scoring, and momentum shifts. It is designed for live betting and hedging decisions.",
    howToUse:
      "Select a live game, watch the projection updates, and compare them to live market prices. Focus on moments where the market lags behind a major shift.",
    unique:
      "Real-time recalculation means you are not relying on stale pregame numbers. The model adapts with every meaningful update.",
    useCases: [
      "Catching live totals swings before the books adjust.",
      "Finding mid-game sides when pace flips.",
      "Hedging positions after unexpected runs.",
    ],
  },
  {
    id: "sharp-detector",
    label: "Sharp Detector",
    route: "/sharp-detector",
    icon: "eye",
    summary:
      "Tracks large market-moving bets, wallet behavior, and sharp signal clustering.",
    description:
      "Sharp Detector monitors high-notional bets and trusted wallet behavior to reveal where sharp money is flowing. It lets you track clusters and timing, not just isolated bets.",
    howToUse:
      "Filter by game, size, or wallet, then look for clusters of big bets in the same market. Use the timing and wallet history to judge whether a move is real.",
    unique:
      "It combines bet size, timing, and wallet history so you can see patterns and conviction.",
    useCases: [
      "Following sharp steam on key markets.",
      "Validating your own edges before betting.",
      "Tracking trusted wallets over time.",
    ],
  },
  {
    id: "ai-chat",
    label: "AI Chat",
    route: "/chat",
    icon: "message-square",
    summary:
      "Natural-language assistant for matchups, edges, and tool guidance.",
    description:
      "AI Chat provides instant analysis, explanations, and tool recommendations based on the same data powering the platform. It is the fastest way to ask a question and get a structured answer.",
    howToUse:
      "Ask about a matchup, request a market summary, or have it explain an edge. Use follow-ups to refine the output into a bet plan.",
    unique:
      "It is integrated with the platform data, so the responses reflect live tools and projections rather than generic advice.",
    useCases: [
      "Quick research before building a card.",
      "Explaining why a line moved.",
      "Finding the best tool for a specific bet type.",
    ],
  },
  {
    id: "live-odds",
    label: "Live Odds",
    route: "/live-scores",
    icon: "clock",
    summary:
      "Real-time odds paired with live scores so you can track movement as games unfold.",
    description:
      "Live Odds pairs scoreboards with live lines, giving you a live view of spreads, totals, and moneylines. It helps you time entries and understand the reason behind line movement.",
    howToUse:
      "Pick a sport or game, monitor the live odds, and compare them to live game state. Watch for sudden shifts after key plays.",
    unique:
      "It combines live scoring context with pricing, which makes odds movement easier to interpret.",
    useCases: [
      "Timing live entries after momentum swings.",
      "Tracking market movement across games.",
      "Finding hedge opportunities during live action.",
    ],
  },
]
