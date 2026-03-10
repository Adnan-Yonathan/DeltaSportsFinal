import type { CoreToolKey } from '@/lib/core-tools'

export const TOOLS_TUTORIAL_METADATA_KEY = 'tools_tutorial_completed'
export const TOOLS_TUTORIAL_LOCAL_KEY = 'delta_tools_tutorial_completed_v1'

export const TOOLS_TUTORIAL_ORDER: CoreToolKey[] = [
  'sharp-projections',
  'sharp-props',
  'whale-feed',
  'sharp-money-feed',
  'research-mode',
]

export const TOOLS_TUTORIAL_COPY: Record<
  CoreToolKey,
  {
    step: number
    howToUse: string
    whyItValuable: string
  }
> = {
  'sharp-projections': {
    step: 1,
    howToUse:
      'Start each slate here. Sort by edge strength, compare projected lines to market numbers, and shortlist the top mismatches first.',
    whyItValuable:
      'It quickly tells you where price is likely wrong, so you focus only on high-value spots instead of scanning every game manually.',
  },
  'sharp-props': {
    step: 2,
    howToUse:
      'Use Sharp Props to read orderbook walls, side pressure, and best available prices before committing to an over or under.',
    whyItValuable:
      'It shows real liquidity intent, which helps you avoid stale prop numbers and enter before books fully adjust.',
  },
  'whale-feed': {
    step: 3,
    howToUse:
      'Use Whale Detector to monitor active whale tickets, then switch to resting liquidity mode to confirm where larger orders are still sitting.',
    whyItValuable:
      'It separates one-off prints from repeated pressure, helping you filter noise and prioritize stronger market signals.',
  },
  'sharp-money-feed': {
    step: 4,
    howToUse:
      'Track qualified profitable bettors by sport, follow high-conviction fills, and review open position exposure before entering.',
    whyItValuable:
      'Sport-specific ROI and risk scoring lets you focus on the bettors and markets with repeatable edge, not generic volume spikes.',
  },
  'research-mode': {
    step: 5,
    howToUse:
      'Review line movement, closing value, and trend behavior after entries to understand what happened and why.',
    whyItValuable:
      'This closes the feedback loop and improves long-term decision quality by turning each bet into measurable process data.',
  },
}
