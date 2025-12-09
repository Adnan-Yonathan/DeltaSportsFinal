/**
 * Sportsbook Promotions Configuration
 * Data source: Complete Guide to US Sportsbook Promotions (December 2025)
 * Last updated: December 8, 2025
 */

import type { SportsbookPromo, PromoFilterOptions, PromosByCategory } from '@/lib/types/promos'
import { PROMO_CATEGORIES, PROMO_TYPES, PROMO_SPORTS } from '@/lib/types/promos'

/**
 * All sportsbook promotions from PDF data
 * Organized by bookmaker, then by category
 */
export const SPORTSBOOK_PROMOS: SportsbookPromo[] = [
  // ========== DRAFTKINGS ==========
  {
    id: 'draftkings-bet5-get200',
    bookmaker: 'draftkings',
    bookmakerDisplayName: 'DraftKings',
    title: 'Bet $5, Get $200 in Bonus Bets',
    description: 'Place $5 wager; if it wins, receive $200 in bonus bets (eight $25 tokens)',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$200',
    minBet: 5,
    featured: true,
    priority: 2,
    link: 'https://sportsbook.draftkings.com/promos',
    states: ['AZ', 'CO', 'CT', 'DC', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'NC', 'NJ', 'NY', 'OH', 'PA', 'TN', 'VA', 'VT', 'WV', 'WY'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'draftkings-bet5-get300-mo',
    bookmaker: 'draftkings',
    bookmakerDisplayName: 'DraftKings',
    title: 'Bet $5, Get $300 (Missouri Launch)',
    description: 'Bet $5 and receive $300 in bonus bets instantly',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$300',
    minBet: 5,
    featured: true,
    priority: 1,
    link: 'https://sportsbook.draftkings.com/promos',
    states: ['MO'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'draftkings-deposit-match',
    bookmaker: 'draftkings',
    bookmakerDisplayName: 'DraftKings',
    title: '20% Deposit Match up to $1,000',
    description: 'Additional deposit match with wagering requirements',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.DEPOSIT_MATCH,
    value: 'Up to $1,000',
    link: 'https://sportsbook.draftkings.com/promos',
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== FANDUEL ==========
  {
    id: 'fanduel-bet5-get150',
    bookmaker: 'fanduel',
    bookmakerDisplayName: 'FanDuel',
    title: 'Bet $5, Get $150 in Bonus Bets',
    description: 'Place $5+ wager; if it wins, receive $150 in bonus bets',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$150',
    minBet: 5,
    featured: true,
    priority: 3,
    link: 'https://www.fanduel.com/promos',
    states: ['AZ', 'CO', 'CT', 'DC', 'IA', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'MI', 'NC', 'NJ', 'NY', 'OH', 'PA', 'TN', 'VA', 'VT', 'WV', 'WY'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'fanduel-bet5-get300-mo',
    bookmaker: 'fanduel',
    bookmakerDisplayName: 'FanDuel',
    title: 'Bet $5, Get $300 + NBA League Pass',
    description: '$300 bonus bets if wager wins, plus 3 months NBA League Pass',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$300 + NBA League Pass',
    minBet: 5,
    featured: true,
    priority: 1,
    link: 'https://www.fanduel.com/promos',
    states: ['MO'],
    sport: PROMO_SPORTS.NBA,
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'fanduel-nba-league-pass',
    bookmaker: 'fanduel',
    bookmakerDisplayName: 'FanDuel',
    title: '3 Months NBA League Pass',
    description: 'Free NBA League Pass with qualifying bet (win or lose)',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.OTHER,
    sport: PROMO_SPORTS.NBA,
    value: '3 Months NBA League Pass',
    link: 'https://www.fanduel.com/promos',
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== BETMGM ==========
  {
    id: 'betmgm-first-bet-1500',
    bookmaker: 'betmgm',
    bookmakerDisplayName: 'BetMGM',
    title: 'First Bet Offer up to $1,500',
    description: 'If first bet loses, receive up to $1,500 back in bonus bets',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.RISK_FREE_BET,
    value: 'Up to $1,500',
    featured: true,
    priority: 1,
    link: 'https://sports.betmgm.com/en/promotions',
    states: ['AZ', 'CO', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'MD', 'MA', 'MI', 'NC', 'NJ', 'NY', 'OH', 'PA', 'TN', 'VA', 'WV', 'WY', 'DC'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'betmgm-bet10-get150',
    bookmaker: 'betmgm',
    bookmakerDisplayName: 'BetMGM',
    title: 'Bet $10, Get $150',
    description: 'Place $10 bet; if it wins, receive $150 in bonus bets',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$150',
    minBet: 10,
    link: 'https://sports.betmgm.com/en/promotions',
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== CAESARS ==========
  {
    id: 'caesars-double-winnings-20',
    bookmaker: 'caesars',
    bookmakerDisplayName: 'Caesars Sportsbook',
    title: 'Bet $1, Double Your Winnings (20 Bets)',
    description: 'Receive 20 separate 100% profit boost tokens (max $25 bet, $2,500 additional winnings each)',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.PROFIT_BOOST,
    value: 'Up to $50,000',
    featured: true,
    priority: 2,
    link: 'https://www.caesars.com/sportsbook-and-casino/promotions',
    states: ['AZ', 'CO', 'DC', 'IA', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'NC', 'NJ', 'NY', 'OH', 'PA', 'TN', 'VA', 'WV', 'WY'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== FANATICS ==========
  {
    id: 'fanatics-nosweat-2000',
    bookmaker: 'fanatics',
    bookmakerDisplayName: 'Fanatics Sportsbook',
    title: 'Up to $2,000 No-Sweat FanCash',
    description: 'Bet $1+ daily for 10 days; if bets lose, receive up to $200/day in FanCash',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.NO_SWEAT,
    value: 'Up to $2,000',
    featured: true,
    priority: 1,
    link: 'https://sportsbook.fanatics.com/promotions',
    states: ['AZ', 'CO', 'CT', 'DC', 'IA', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'MI', 'MO', 'NC', 'NJ', 'OH', 'PA', 'TN', 'VA', 'VT', 'WV', 'WY'],
    excludedStates: ['NY'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'fanatics-bet30-get300',
    bookmaker: 'fanatics',
    bookmakerDisplayName: 'Fanatics Sportsbook',
    title: 'Bet $30, Get $300 FanCash',
    description: 'Wager $10/day for 3 days to receive $100 FanCash per day',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.CASHBACK,
    value: '$300 FanCash',
    minBet: 30,
    link: 'https://sportsbook.fanatics.com/promotions',
    states: ['AZ', 'IN', 'MI', 'NJ', 'PA', 'TN', 'VA', 'MO'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== BETRIVERS ==========
  {
    id: 'betrivers-second-chance-500',
    bookmaker: 'betrivers',
    bookmakerDisplayName: 'BetRivers',
    title: 'Second Chance Bet up to $500',
    description: '100% stake back as bonus bet if first bet loses',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.RISK_FREE_BET,
    value: 'Up to $500',
    link: 'https://www.betrivers.com/promotions',
    states: ['IL', 'IN', 'LA', 'MD', 'MI', 'PA', 'VA', 'CO', 'DE', 'NJ', 'AZ', 'IA', 'NY', 'OH', 'WV'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== HARD ROCK BET ==========
  {
    id: 'hardrock-bet5-get150',
    bookmaker: 'hardrock',
    bookmakerDisplayName: 'Hard Rock Bet',
    title: 'Bet $5, Get $150 (If You Win)',
    description: 'Win first $5+ wager to receive $150 in bonus bets (six $25 tokens)',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$150',
    minBet: 5,
    link: 'https://www.hardrock.bet/promo-code',
    states: ['AZ', 'CO', 'FL', 'IL', 'IN', 'MI', 'NJ', 'OH', 'TN', 'VA'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== BET365 ==========
  {
    id: 'bet365-bet5-get150',
    bookmaker: 'bet365',
    bookmakerDisplayName: 'bet365',
    title: 'Bet $5, Get $150 in Bonus Bets',
    description: 'Deposit $10+, bet $5+ on any market; receive $150 in bonus bets win or lose',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$150',
    minBet: 5,
    minDeposit: 10,
    featured: true,
    priority: 4,
    link: 'https://www.bet365.com',
    states: ['AZ', 'CO', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'MD', 'MO', 'NC', 'NJ', 'OH', 'PA', 'TN', 'VA'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'bet365-first-bet-1000',
    bookmaker: 'bet365',
    bookmakerDisplayName: 'bet365',
    title: '$1,000 First Bet Safety Net',
    description: 'If first bet loses, receive stake back up to $1,000',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.RISK_FREE_BET,
    value: 'Up to $1,000',
    featured: true,
    priority: 2,
    link: 'https://www.bet365.com',
    excludedStates: ['NJ', 'PA'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
  {
    id: 'bet365-bet10-get365-mo',
    bookmaker: 'bet365',
    bookmakerDisplayName: 'bet365',
    title: 'Missouri Launch: Bet $10, Get $365',
    description: 'Place $10 wager, receive $365 in bonus bets',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$365',
    minBet: 10,
    featured: true,
    priority: 1,
    link: 'https://www.bet365.com',
    states: ['MO'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== THESCORE BET (ESPN BET) ==========
  {
    id: 'thescorebet-bet10-get100',
    bookmaker: 'thescorebet',
    bookmakerDisplayName: 'theScore Bet',
    title: 'Bet $10, Get $100 + 30 Days ESPN+',
    description: 'Bet $10, receive $100 in bonus bets if first bet wins',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$100 + ESPN+',
    minBet: 10,
    link: 'https://about.espnbet.com/promos',
    states: ['AZ', 'CO', 'DC', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'MD', 'MA', 'MI', 'MO', 'NC', 'NJ', 'NY', 'OH', 'PA', 'TN', 'VA', 'WV'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== BALLY BET ==========
  {
    id: 'ballybet-bet10-get50',
    bookmaker: 'ballybet',
    bookmakerDisplayName: 'Bally Bet',
    title: 'Bet $10, Get $50',
    description: 'Place $10+ bet, receive $50 in bonus bets regardless of outcome',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$50',
    minBet: 10,
    link: 'https://www.ballybet.com',
    states: ['AZ', 'CO', 'IN', 'IA', 'NJ', 'NY', 'OH', 'TN', 'VA'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== BORGATA ==========
  {
    id: 'borgata-bet20-get100',
    bookmaker: 'borgata',
    bookmakerDisplayName: 'Borgata',
    title: 'Bet $20, Get $100',
    description: 'Bet $20+ at -200 odds or longer; receive $100 in bonus bets',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$100',
    minBet: 20,
    minOdds: -200,
    link: 'https://sports.borgataonline.com/en/promotions',
    states: ['NJ'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },

  // ========== GOLDEN NUGGET ==========
  {
    id: 'goldennugget-first-bet-match-250',
    bookmaker: 'goldennugget',
    bookmakerDisplayName: 'Golden Nugget',
    title: '100% First Bet Match up to $250',
    description: 'First wager matched as bonus bet up to $250',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.RISK_FREE_BET,
    value: 'Up to $250',
    link: 'https://sportsbook.goldennuggetcasino.com/promotions',
    states: ['NJ', 'WV'],
    expiresAt: '2026-01-31T23:59:59Z',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-08T00:00:00Z',
  },
]

/**
 * Filter promos based on options
 */
export function filterPromos(
  promos: SportsbookPromo[],
  filters: PromoFilterOptions = {}
): SportsbookPromo[] {
  let filtered = promos

  // Filter expired promos
  if (filters.activeOnly !== false) {
    const now = new Date()
    filtered = filtered.filter(p => !p.expiresAt || new Date(p.expiresAt) > now)
  }

  // Filter by category
  if (filters.category) {
    const categories = Array.isArray(filters.category) ? filters.category : [filters.category]
    filtered = filtered.filter(p => categories.includes(p.category))
  }

  // Filter by bookmaker
  if (filters.bookmaker) {
    const bookmakers = Array.isArray(filters.bookmaker) ? filters.bookmaker : [filters.bookmaker]
    filtered = filtered.filter(p => bookmakers.includes(p.bookmaker))
  }

  // Filter by sport
  if (filters.sport) {
    filtered = filtered.filter(p => !p.sport || p.sport === filters.sport || p.sport === 'general')
  }

  // Filter by state
  if (filters.state && filters.state !== 'ALL') {
    filtered = filtered.filter(p => {
      // If excluded states list includes this state, exclude the promo
      if (p.excludedStates && p.excludedStates.includes(filters.state!)) {
        return false
      }
      // If states list exists, check if state is included
      if (p.states && p.states.length > 0) {
        return p.states.includes(filters.state!)
      }
      // If no states array, promo is available everywhere (except excluded states)
      return true
    })
  }

  // Sort by priority, then by updated date
  return filtered.sort((a, b) => {
    if (a.priority !== b.priority) {
      return (a.priority || 999) - (b.priority || 999)
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

/**
 * Group promos by category
 */
export function groupPromosByCategory(promos: SportsbookPromo[]): PromosByCategory {
  return {
    [PROMO_CATEGORIES.NEW_USER]: promos.filter(p => p.category === PROMO_CATEGORIES.NEW_USER),
    [PROMO_CATEGORIES.ACTIVE_USER]: promos.filter(p => p.category === PROMO_CATEGORIES.ACTIVE_USER),
    [PROMO_CATEGORIES.SPORT_SPECIFIC]: promos.filter(p => p.category === PROMO_CATEGORIES.SPORT_SPECIFIC),
    [PROMO_CATEGORIES.SEASONAL]: promos.filter(p => p.category === PROMO_CATEGORIES.SEASONAL),
  }
}
