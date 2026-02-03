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
    id: "sharp-detector",
    label: "Whale Feed",
    route: "/sharp-detector",
    icon: "eye",
    summary:
      "Live feed of sharp money, market-moving bets, and clustered sharp action.",
    description:
      "Whale Feed tracks high-notional bets across prediction markets and groups them by game so you can see where sharp money is concentrating. It pairs bet size with timing and wallet context to surface true sharp action.",
    howToUse:
      "Filter by sport, size, or wallet, then focus on games with multiple large bets. Use the wallet tags and strength signals to validate whether a sharp money move is worth following.",
    unique:
      "It combines bet size, wallet history, and clustering so you see real pressure, not just isolated bets.",
    useCases: [
      "Tracking sharp steam before lines move.",
      "Monitoring trusted wallets on game day.",
      "Validating a position with live sharp money flow.",
    ],
  },
  {
    id: "market-projections",
    label: "Market Projections",
    route: "/market-projections",
    icon: "line-chart",
    summary:
      "Game-level projections mapped to fair prices, confidence, and edge.",
    description:
      "Market Projections converts model output into fair lines and probability ranges, so you can quickly see where the market is mispriced. It ties projections directly to listed odds to highlight value.",
    howToUse:
      "Choose a sport and slate, sort by edge or confidence, and compare the fair price to each book. Prioritize lines that stay positive across multiple books.",
    unique:
      "You always compare projection vs price, not just a raw stat projection.",
    useCases: [
      "Finding early slate value before the market shifts.",
      "Price shopping across books to lock in edge.",
      "Filtering to the most confident sides and totals.",
    ],
  },
  {
    id: "player-prop-odds",
    label: "Player Prop Odds",
    route: "/player-prop-odds",
    icon: "users",
    summary:
      "Best prop prices across books with quick EV and discrepancy flags.",
    description:
      "Player Prop Odds aggregates prop lines across sportsbooks, highlights the best over/under prices, and surfaces EV signals from consensus pricing.",
    howToUse:
      "Filter by market or team, scan for the best prices, and focus on props showing strong discrepancies or EV markers.",
    unique:
      "It surfaces both best price and implied edge in one view, so you can act fast.",
    useCases: [
      "Finding the best price on a specific prop.",
      "Spotting mispriced props before books sync.",
      "Building prop cards with clear value flags.",
    ],
  },
  {
    id: "line-shopping",
    label: "Line Shopping",
    route: "/line-shopping",
    icon: "target",
    summary:
      "Side-by-side odds comparison across books for spreads, totals, and moneylines.",
    description:
      "Line Shopping scans major sportsbooks so you can instantly see where each line is best. It highlights the price gaps that swing EV from negative to positive.",
    howToUse:
      "Pick the market, compare the best prices, and lock your bet at the top line. Re-check after news to see which book lags.",
    unique:
      "It shows the full price distribution so you can see how far off each book is.",
    useCases: [
      "Maximizing edge by selecting the best book.",
      "Tracking which books are slow to move.",
      "Finding +EV prices before they close.",
    ],
  },
  {
    id: "parlay-predictor",
    label: "Parlay Predictor",
    route: "/parlay-predictor",
    icon: "layers",
    summary:
      "EV parlays plus a builder for custom multi-leg tickets.",
    description:
      "Parlay Predictor surfaces positive-EV parlays from sportsbook pricing, then lets you build your own tickets with correlation-aware math.",
    howToUse:
      "Start with the EV list, then switch to Build Your Own to stack legs. Keep tickets that meet the listed minimum odds for +EV.",
    unique:
      "It blends sportsbook-only pricing with correlation checks to keep parlays honest.",
    useCases: [
      "Taking EV parlays above a 3% edge.",
      "Building 2-5 leg parlays with verified value.",
      "Checking minimum odds to keep a parlay +EV.",
    ],
  },
  {
    id: "sharp-traders",
    label: "Sharp Traders",
    route: "/sharp-traders",
    icon: "zap",
    summary:
      "Top-profit prediction market wallets and their live open positions.",
    description:
      "Sharp Traders highlights the most profitable wallets and shows the positions they are still holding. It helps you see where sharp accounts are allocating right now.",
    howToUse:
      "Filter by sport, scan each wallet's open trades, and note positions that repeat across multiple sharp wallets.",
    unique:
      "It links wallet performance directly to live, unsettled trades.",
    useCases: [
      "Following repeat positions across profitable wallets.",
      "Spotting sharp wallets before lines move.",
      "Monitoring open exposure on game day.",
    ],
  },
]
