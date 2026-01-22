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
      "Sportsbook EV parlays plus a builder for custom multi-leg tickets.",
    description:
      "Parlay Pro surfaces pregame EV parlays using cross-market sportsbook consensus, then lets you build your own tickets with correlation-aware probability math.",
    howToUse:
      "Start on the EV Parlays tab to grab a sportsbook-ready ticket, then switch to Build Your Own to stack correlated legs. Only keep tickets that meet the listed minimum odds for 3%+ EV.",
    unique:
      "It combines sportsbook-only EV scans with correlation checks, so you can price-shop and still understand whether a parlay stays +EV.",
    useCases: [
      "Taking sportsbook EV parlays above a 3% edge.",
      "Building 2-5 leg parlays with verified edges.",
      "Checking the minimum odds needed to keep a parlay +EV.",
    ],
  },
  {
    id: "ev-bets",
    label: "Line Shopping",
    route: "/ev-bets",
    icon: "percent",
    summary:
      "Pregame odds board for moneylines, spreads, and totals across the books we track.",
    description:
      "Line Shopping is a dense screen for quickly scanning the best pregame prices across sportsbooks and prediction markets.",
    howToUse:
      "Pick a sport and market, then scan the board for the best pregame line. If the price you want is available, place the bet before it moves.",
    unique:
      "It compresses the entire slate into one view, showing the strongest price per side without the noise.",
    useCases: [
      "Fast line shopping before your bet hits.",
      "Monitoring pregame movement across books.",
      "Comparing prediction markets vs sportsbooks.",
    ],
  },
  {
    id: "live-projections",
    label: "Live Projections",
    route: "/live-projections",
    icon: "activity",
    summary:
      "ESPN win probability with live spread ranges and confidence bands.",
    description:
      "Live Projections turns ESPN win probability into a live spread range, shrinking the interval as the game progresses. It is designed for live betting and hedging decisions.",
    howToUse:
      "Watch the ESPN win probability meter and compare the spread range to your live book. Focus on moments where the market lags behind a major shift.",
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
    label: "Whale Feed",
    route: "/sharp-detector",
    icon: "eye",
    summary:
      "Tracks large market-moving bets, wallet behavior, and sharp signal clustering.",
    description:
      "Whale Feed monitors high-notional bets and trusted wallet behavior to reveal where sharp money is flowing. It lets you track clusters and timing, not just isolated bets.",
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
