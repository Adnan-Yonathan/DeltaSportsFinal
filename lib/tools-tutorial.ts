import type { CoreToolKey } from '@/lib/core-tools'

export const TOOLS_TUTORIAL_METADATA_KEY = 'tools_tutorial_completed'
export const TOOLS_TUTORIAL_LOCAL_KEY = 'delta_tools_tutorial_completed_v1'

export const TOOLS_TUTORIAL_ORDER: CoreToolKey[] = [
  'sharp-projections',
  'sharp-props',
  'whale-feed',
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
      'Monitor large tickets and timing clusters, then compare that money flow against sportsbook movement to validate conviction.',
    whyItValuable:
      'You can separate noise from meaningful steam and prioritize bets where size and timing imply informed action.',
  },
  'research-mode': {
    step: 4,
    howToUse:
      'Review line movement, closing value, and trend behavior after entries to understand what happened and why.',
    whyItValuable:
      'This closes the feedback loop and improves long-term decision quality by turning each bet into measurable process data.',
  },
}

