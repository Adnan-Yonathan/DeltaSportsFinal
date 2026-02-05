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
    id: "crossed-ev",
    label: "Sharp Props",
    route: "/crossed-ev",
    icon: "percent",
    summary:
      "Find crossed prop lines and rank them by EV vs consensus.",
    description:
      "Sharp Props ranks player props where a specific book's line is far off the market consensus line, then estimates EV% by comparing book odds to consensus odds and accounting for line discrepancy.",
    howToUse:
      "Pick a sport, then scan the top-ranked props. If a book is low vs consensus, it tends to favor the over. If it's high vs consensus, it tends to favor the under. Always confirm injury/news context before firing.",
    unique:
      "It's line-first: you see which books are crossed from consensus before the market snaps back.",
    useCases: [
      "Finding books that are slow to update prop lines.",
      "Spotting crossed numbers after news or lineup changes.",
      "Identifying the cleanest line edges before prices converge.",
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
