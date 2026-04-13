export type CoreToolKey =
  | 'sharp-projections'
  | 'sharp-props'
  | 'whale-feed'
  | 'research-mode'
  | 'insider-feed'

export type CoreTool = {
  key: CoreToolKey
  label: string
  shortLabel: string
  summary: string
  icon: 'radar' | 'percent' | 'waves' | 'beaker' | 'eye'
  guideRoute: string
  productRoute: string
  bullets: string[]
}

export const CORE_TOOLS: CoreTool[] = [
  {
    key: 'sharp-projections',
    label: 'Sharp Movement',
    shortLabel: 'Movement',
    summary: 'Pinnacle line movement and limit expansion in one board.',
    icon: 'radar',
    guideRoute: '/tools/sharp-projections',
    productRoute: '/market-projections',
    bullets: [
      'Track opening-to-current movement across spreads, totals, and moneylines.',
      'Rank the board by move velocity and limit expansion.',
      'Use it first to route where sharp market pressure is building.',
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
    label: 'Whale Detector',
    shortLabel: 'Whales',
    summary: 'Live whale tape and clustering across active and resting flow.',
    icon: 'waves',
    guideRoute: '/tools/whale-feed',
    productRoute: '/sharp-detector',
    bullets: [
      'Track large tickets and clustered action in one feed.',
      'Toggle between active fills and resting liquidity walls.',
      'Use it to confirm market pressure before executing.',
    ],
  },
  {
    key: 'research-mode',
    label: 'Sharp Movement',
    shortLabel: 'Movement',
    summary: 'Pinnacle line movement and limit expansion in one board.',
    icon: 'radar',
    guideRoute: '/tools/sharp-projections',
    productRoute: '/market-projections',
    bullets: [
      'Track opening-to-current movement across spreads, totals, and moneylines.',
      'Rank the board by move velocity and limit expansion.',
      'Use it first to route where sharp market pressure is building.',
    ],
  },
  {
    key: 'insider-feed',
    label: 'Insider Feed',
    shortLabel: 'Insider',
    summary: 'Track verified profitable wallets and their open sports positions on Polymarket.',
    icon: 'eye',
    guideRoute: '/tools/insider-feed',
    productRoute: '/polymarket-insider',
    bullets: [
      'See open positions from top-ROI Polymarket wallets.',
      'Insider scores rank each bet by authority and conviction.',
      'Use it to spot where proven winners are allocating capital.',
    ],
  },
]

export const CORE_TOOLS_BY_KEY = Object.fromEntries(
  CORE_TOOLS.map((tool) => [tool.key, tool])
) as Record<CoreToolKey, CoreTool>
