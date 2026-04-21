/**
 * Registry of individual calculator pages for programmatic SEO.
 *
 * Each entry powers one URL at /calculators/[slug] with its own metadata,
 * primary keyword target, and schema markup. Only `published: true` entries
 * get rendered routes and sitemap inclusion — drafts 404 until content is
 * written (avoids thin-content penalties).
 *
 * See docs/PROGRAMMATIC_SEO_STRATEGY.md section 3.
 */

export type CalculatorSlug =
  | 'kelly-criterion'
  | 'no-vig'
  | 'expected-value'
  | 'hold'
  | 'parlay'
  | 'arbitrage'
  | 'hedge'
  | 'odds-converter'
  | 'clv'
  | 'implied-probability'
  | 'round-robin'
  | 'teaser'
  | 'middle'
  | 'half-point'
  | 'poisson'
  | 'fair-odds'
  | 'bankroll'
  | 'unit-size'
  | 'breakeven'
  | 'devig'
  | 'freeplay'
  | 'parlay-odds'

export interface CalculatorEntry {
  slug: CalculatorSlug
  name: string
  title: string
  description: string
  primaryKeyword: string
  secondaryKeywords: string[]
  category: 'edge' | 'payout' | 'conversion' | 'sizing'
  published: boolean
}

export const CALCULATORS: CalculatorEntry[] = [
  {
    slug: 'kelly-criterion',
    name: 'Kelly Criterion',
    title: 'Kelly Criterion Calculator — Optimal Bet Sizing | Delta Sports',
    description:
      'Size every bet by your edge, not gut feel. Free Kelly Criterion calculator with fractional Kelly, worked example, and when sharp bettors actually use it.',
    primaryKeyword: 'kelly criterion calculator',
    secondaryKeywords: [
      'kelly calculator betting',
      'fractional kelly',
      'kelly formula sports betting',
      'optimal bet size calculator',
    ],
    category: 'sizing',
    published: true,
  },
  { slug: 'no-vig', name: 'No-Vig Fair Odds', title: '', description: '', primaryKeyword: 'no vig calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'expected-value', name: 'Expected Value', title: '', description: '', primaryKeyword: 'expected value betting calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'hold', name: 'Sportsbook Hold', title: '', description: '', primaryKeyword: 'sportsbook hold calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'parlay', name: 'Parlay', title: '', description: '', primaryKeyword: 'parlay calculator', secondaryKeywords: [], category: 'payout', published: false },
  { slug: 'arbitrage', name: 'Arbitrage', title: '', description: '', primaryKeyword: 'arbitrage betting calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'hedge', name: 'Hedge', title: '', description: '', primaryKeyword: 'hedge bet calculator', secondaryKeywords: [], category: 'payout', published: false },
  { slug: 'odds-converter', name: 'Odds Converter', title: '', description: '', primaryKeyword: 'odds converter', secondaryKeywords: [], category: 'conversion', published: false },
  { slug: 'clv', name: 'CLV', title: '', description: '', primaryKeyword: 'clv calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'implied-probability', name: 'Implied Probability', title: '', description: '', primaryKeyword: 'implied probability calculator', secondaryKeywords: [], category: 'conversion', published: false },
  { slug: 'round-robin', name: 'Round Robin', title: '', description: '', primaryKeyword: 'round robin bet calculator', secondaryKeywords: [], category: 'payout', published: false },
  { slug: 'teaser', name: 'Teaser', title: '', description: '', primaryKeyword: 'teaser calculator', secondaryKeywords: [], category: 'payout', published: false },
  { slug: 'middle', name: 'Middle', title: '', description: '', primaryKeyword: 'middle bet calculator', secondaryKeywords: [], category: 'payout', published: false },
  { slug: 'half-point', name: 'Half Point', title: '', description: '', primaryKeyword: 'half point calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'poisson', name: 'Poisson', title: '', description: '', primaryKeyword: 'poisson calculator betting', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'fair-odds', name: 'Fair Odds', title: '', description: '', primaryKeyword: 'fair odds calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'bankroll', name: 'Bankroll', title: '', description: '', primaryKeyword: 'betting bankroll calculator', secondaryKeywords: [], category: 'sizing', published: false },
  { slug: 'unit-size', name: 'Unit Size', title: '', description: '', primaryKeyword: 'betting unit size calculator', secondaryKeywords: [], category: 'sizing', published: false },
  { slug: 'breakeven', name: 'Breakeven', title: '', description: '', primaryKeyword: 'betting breakeven calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'devig', name: 'Devig', title: '', description: '', primaryKeyword: 'devig calculator', secondaryKeywords: [], category: 'edge', published: false },
  { slug: 'freeplay', name: 'Free Play', title: '', description: '', primaryKeyword: 'free play calculator', secondaryKeywords: [], category: 'payout', published: false },
  { slug: 'parlay-odds', name: 'Parlay Odds', title: '', description: '', primaryKeyword: 'parlay odds calculator', secondaryKeywords: [], category: 'payout', published: false },
]

export const getCalculator = (slug: string): CalculatorEntry | undefined =>
  CALCULATORS.find((c) => c.slug === slug)

export const getPublishedCalculators = (): CalculatorEntry[] =>
  CALCULATORS.filter((c) => c.published)
