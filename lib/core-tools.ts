export type CoreToolKey =
  | 'sharp-projections'
  | 'sharp-props'
  | 'whale-feed'
  | 'research-mode'

export type CoreTool = {
  key: CoreToolKey
  label: string
  shortLabel: string
  summary: string
  icon: 'radar' | 'percent' | 'waves' | 'beaker'
  guideRoute: string
  productRoute: string
  bullets: string[]
}

export const CORE_TOOLS: CoreTool[] = [
  {
    key: 'sharp-projections',
    label: 'Sharp Projections',
    shortLabel: 'Projections',
    summary: 'Market-driven lines that show where the number is wrong.',
    icon: 'radar',
    guideRoute: '/tools/sharp-projections',
    productRoute: '/market-projections',
    bullets: [
      'See fair lines vs market prices at a glance.',
      'Sort by edge and confidence to find the best gaps.',
      'Use it first to route where you spend attention.',
    ],
  },
  {
    key: 'sharp-props',
    label: 'Sharp Props',
    shortLabel: 'Props',
    summary: 'Order-book liquidity and sharp leaning sides across prop markets.',
    icon: 'percent',
    guideRoute: '/tools/sharp-props',
    productRoute: '/sharp-props',
    bullets: [
      'See order-book liquidity to spot sharp prices and sides.',
      'Track the biggest resting walls and weighted market lean.',
      'Use it to confirm direction before placing the bet.',
    ],
  },
  {
    key: 'whale-feed',
    label: 'Whale Feed',
    shortLabel: 'Whales',
    summary: 'Big money alerts with exchange context and clustering.',
    icon: 'waves',
    guideRoute: '/tools/whale-feed',
    productRoute: '/sharp-detector',
    bullets: [
      'Watch large bets hit the tape in real time.',
      'Cluster activity to see where pressure is building.',
      'Use it to confirm steam and timing.',
    ],
  },
  {
    key: 'research-mode',
    label: 'Research Mode',
    shortLabel: 'Research',
    summary: 'Explain movement, validate a thesis, and study closes.',
    icon: 'beaker',
    guideRoute: '/tools/research-mode',
    productRoute: '/research/sharp-action',
    bullets: [
      'Understand why the market is moving.',
      'Backtest and review what closes actually did.',
      'Use it to build a repeatable process.',
    ],
  },
]

export const CORE_TOOLS_BY_KEY = Object.fromEntries(
  CORE_TOOLS.map((tool) => [tool.key, tool])
) as Record<CoreToolKey, CoreTool>
