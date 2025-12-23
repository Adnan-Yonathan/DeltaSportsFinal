/**
 * Sportsbook Promotions Type Definitions
 * Defines the structure for sportsbook promotional offers
 */

/**
 * Categories of sportsbook promotions
 */
export const PROMO_CATEGORIES = {
  NEW_USER: 'new_user',
  ACTIVE_USER: 'active_user',
  SPORT_SPECIFIC: 'sport_specific',
  SEASONAL: 'seasonal',
  DAILY: 'daily',
  PEER_TO_PEER: 'peer_to_peer',
} as const

export type PromoCategory = typeof PROMO_CATEGORIES[keyof typeof PROMO_CATEGORIES]

/**
 * Target sports for sport-specific promos
 */
export const PROMO_SPORTS = {
  NFL: 'nfl',
  NBA: 'nba',
  MLB: 'mlb',
  NHL: 'nhl',
  NCAAF: 'ncaaf',
  NCAAB: 'ncaab',
  SOCCER: 'soccer',
  GENERAL: 'general',
} as const

export type PromoSport = typeof PROMO_SPORTS[keyof typeof PROMO_SPORTS]

/**
 * Promotion offer types
 */
export const PROMO_TYPES = {
  DEPOSIT_MATCH: 'deposit_match',      // e.g., "100% deposit match up to $1000"
  BONUS_BETS: 'bonus_bets',            // e.g., "Bet $5, Get $150 in Bonus Bets"
  RISK_FREE_BET: 'risk_free_bet',      // e.g., "Up to $1000 risk-free bet"
  ODDS_BOOST: 'odds_boost',            // e.g., "Daily Odds Boosts"
  PARLAY_INSURANCE: 'parlay_insurance', // e.g., "Parlay insurance on 4+ legs"
  NO_SWEAT: 'no_sweat',                // e.g., "No sweat first bet"
  PROFIT_BOOST: 'profit_boost',        // e.g., "50% profit boost token"
  CASHBACK: 'cashback',                // e.g., "10% cashback on losses"
  LOYALTY_PROGRAM: 'loyalty_program',  // e.g., "Earn points on bets"
  REFER_FRIEND: 'refer_friend',        // e.g., "$50 per referral"
  FREE_BET: 'free_bet',                // e.g., "Free $10 bet"
  OTHER: 'other',
} as const

export type PromoType = typeof PROMO_TYPES[keyof typeof PROMO_TYPES]

/**
 * Individual sportsbook promotion
 */
export interface SportsbookPromo {
  id: string                          // Unique identifier (e.g., "draftkings-new-user-dec-2024")
  bookmaker: string                   // Key from bookmaker-links.ts (e.g., "draftkings")
  bookmakerDisplayName: string        // Display name (e.g., "DraftKings")
  title: string                       // Short title (e.g., "Bet $5, Get $300")
  description: string                 // Detailed description
  category: PromoCategory             // Primary category
  type: PromoType                     // Offer type
  sport?: PromoSport                  // Optional: specific sport (if sport_specific)

  // Offer details
  value?: string                      // e.g., "$300", "100%", "Up to $1000"
  minDeposit?: number                 // Minimum deposit required (in USD)
  minOdds?: number                    // Minimum odds required (American format)
  minBet?: number                     // Minimum bet amount

  // Terms
  promoCode?: string                  // Optional promo code
  expiresAt?: string                  // ISO date string
  link: string                        // Direct link to promo page
  termsUrl?: string                   // Link to full T&Cs
  states?: string[]                   // Available states (e.g., ["NJ", "PA", "MI"])
  excludedStates?: string[]           // States where NOT available

  // Metadata
  featured?: boolean                  // Highlight this promo
  priority?: number                   // Display order (lower = higher priority)
  createdAt: string                   // ISO date string
  updatedAt: string                   // ISO date string
}

/**
 * Grouped promotions by category
 */
export interface PromosByCategory {
  [PROMO_CATEGORIES.NEW_USER]: SportsbookPromo[]
  [PROMO_CATEGORIES.ACTIVE_USER]: SportsbookPromo[]
  [PROMO_CATEGORIES.SPORT_SPECIFIC]: SportsbookPromo[]
  [PROMO_CATEGORIES.SEASONAL]: SportsbookPromo[]
  [PROMO_CATEGORIES.DAILY]: SportsbookPromo[]
  [PROMO_CATEGORIES.PEER_TO_PEER]: SportsbookPromo[]
}

/**
 * API response format
 */
export interface PromosApiResponse {
  promos: SportsbookPromo[]
  lastUpdated: string
  count: number
  categories: {
    category: PromoCategory
    count: number
  }[]
}

/**
 * Filter options for promo queries
 */
export interface PromoFilterOptions {
  category?: PromoCategory | PromoCategory[]
  bookmaker?: string | string[]
  sport?: PromoSport
  state?: string
  activeOnly?: boolean  // Filter out expired promos
}

/**
 * US States for state selector
 */
export const US_STATES = [
  { code: 'ALL', name: 'All States' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DC', name: 'Washington DC' },
  { code: 'FL', name: 'Florida' },
  { code: 'IA', name: 'Iowa' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MD', name: 'Maryland' },
  { code: 'ME', name: 'Maine' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MO', name: 'Missouri' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NY', name: 'New York' },
  { code: 'OH', name: 'Ohio' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'VA', name: 'Virginia' },
  { code: 'VT', name: 'Vermont' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WY', name: 'Wyoming' },
] as const
