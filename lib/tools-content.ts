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
    id: "sharp-props",
    label: "Sharp Props",
    route: "/sharp-props",
    icon: "percent",
    summary:
      "Read live prop order books to find liquidity walls and sharp leaning sides.",
    description:
      "Sharp Props scans live prediction-market order books and highlights where the largest resting liquidity sits for each player prop. It converts wall prices into American odds and surfaces the side with the strongest orderbook support.",
    howToUse:
      "Pick a sport, then sort by order size. Start with markets showing large walls, compare sharp lean odds to your sportsbook price, and prioritize spots where orderbook direction aligns with your projection.",
    unique:
      "It is liquidity-first: you see where real money is resting in the book, not just a model output.",
    useCases: [
      "Finding props with the largest resting liquidity walls.",
      "Tracking over/under side pressure before sportsbook adjustments.",
      "Validating your projection with live orderbook conviction.",
    ],
  },
]
