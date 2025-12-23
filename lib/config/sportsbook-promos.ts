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
  // ========== DRAFTKINGS SPORT-SPECIFIC ==========
  {
    id: 'draftkings-king-of-endzone',
    bookmaker: 'draftkings',
    bookmakerDisplayName: 'DraftKings',
    title: 'King of the Endzone Contest',
    description:
      'Opt-in NFL promo where touchdown scorer wagers that award the longest TD of the game split a $2,000,000 bonus in DraftKings credit',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.OTHER,
    sport: PROMO_SPORTS.NFL,
    value: 'Share of $2,000,000 bonus bets',
    link: 'https://sportsbook.draftkings.com/promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== FANDEUL SPORT-SPECIFIC ==========
  {
    id: 'fanduel-cfp-50-boost',
    bookmaker: 'fanduel',
    bookmakerDisplayName: 'FanDuel',
    title: 'College Football 50% Profit Boost',
    description:
      'Limited-time boost token for a featured College Football Playoff game (example: Alabama vs. Oklahoma) that increases profits by 50%',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.PROFIT_BOOST,
    sport: PROMO_SPORTS.NCAAF,
    value: '50% profit boost',
    link: 'https://sportsbook.fanduel.com/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'fanduel-mo-falcons-100',
    bookmaker: 'fanduel',
    bookmakerDisplayName: 'FanDuel',
    title: 'Missouri NFL 100% Profit Boost',
    description:
      'Missouri-specific boost that doubled profit potential for Falcons vs. Buccaneers bets on 12/11/2025',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.PROFIT_BOOST,
    sport: PROMO_SPORTS.NFL,
    states: ['MO'],
    value: '100% profit boost (MO only)',
    link: 'https://www.fanduel.com/research/fanduel-missouri-promo-offer-100-profit-boost',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== BETMGM SPORT-SPECIFIC ==========
  {
    id: 'betmgm-nhl-hat-trick-jackpot',
    bookmaker: 'betmgm',
    bookmakerDisplayName: 'BetMGM',
    title: 'NHL Hat Trick Jackpot',
    description:
      'Opt-in promo where hat trick scorers unlock a $10,000 bonus bet pool split among eligible bettors',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.BONUS_BETS,
    sport: PROMO_SPORTS.NHL,
    value: 'Share of $10,000 in bonus bets',
    link: 'https://sports.betmgm.com/en/blog/latest-sports-betting-promotions-offers-betmgm-2/',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betmgm-epl-early-payout',
    bookmaker: 'betmgm',
    bookmakerDisplayName: 'BetMGM',
    title: 'EPL Early Payout Moneyline Insurance',
    description:
      'Moneyline sacks on English Premier League games cash out early once your team leads 2-0, even if the match ends in a draw or loss',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.ODDS_BOOST,
    sport: PROMO_SPORTS.SOCCER,
    value: 'Early payout after 2-0 lead',
    link: 'https://sports.betmgm.com/en/blog/latest-sports-betting-promotions-offers-betmgm-2/',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== BET365 SPORT-SPECIFIC ==========
  {
    id: 'bet365-parlay-bonus',
    bookmaker: 'bet365',
    bookmakerDisplayName: 'bet365',
    title: 'Parlay Bonus up to 100%',
    description:
      'Parlays boost by an increasing percentage (e.g., 5% for 3 legs, up to 100% for 14+ legs) across sports',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.PROFIT_BOOST,
    value: '5%–100% parlay boost',
    link: 'https://us.bet365.com/#/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'bet365-nba-ncaaf-boosts',
    bookmaker: 'bet365',
    bookmakerDisplayName: 'bet365',
    title: 'NBA & NCAAF Profit Boost Tokens',
    description:
      'NBA Super Profit Boost (50%) and college football same-game parlay boost (30% during bowl season)',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.PROFIT_BOOST,
    sport: PROMO_SPORTS.NBA,
    value: '50% NBA / 30% NCAAF profit boosts',
    link: 'https://us.bet365.com/#/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== THESCORE BET ACTIVE ==========
  {
    id: 'thescorebet-injury-insurance',
    bookmaker: 'thescorebet',
    bookmakerDisplayName: 'theScore Bet',
    title: 'Injury Insurance (NFL/NBA)',
    description:
      'Refunds losing bets as site credit when a star player injury swings select NFL or NBA outcomes',
    category: PROMO_CATEGORIES.ACTIVE_USER,
    type: PROMO_TYPES.CASHBACK,
    sport: PROMO_SPORTS.GENERAL,
    value: 'Bonus bet refund',
    link: 'https://www.thescore.bet/promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'thescorebet-shootout-protection',
    bookmaker: 'thescorebet',
    bookmakerDisplayName: 'theScore Bet',
    title: 'NHL Shootout Protection',
    description:
      'Refunds NHL moneyline bets that lose in a shootout, reducing the risk of extended games',
    category: PROMO_CATEGORIES.ACTIVE_USER,
    type: PROMO_TYPES.OTHER,
    sport: PROMO_SPORTS.NHL,
    link: 'https://www.thescore.bet/promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== POINTSBET ==========
  {
    id: 'pointsbet-karma-committee',
    bookmaker: 'pointsbet',
    bookmakerDisplayName: 'PointsBet',
    title: 'Karma Kommittee Refunds',
    description:
      'PointsBet may refund bets as bonus credit when a “bad beat” (freak injury, officiating) ruins a wager',
    category: PROMO_CATEGORIES.ACTIVE_USER,
    type: PROMO_TYPES.CASHBACK,
    value: 'Case-by-case bonus credit refunds',
    link: 'https://www.pointsbet.com/promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== BETRIVERS ACTIVE ==========
  {
    id: 'betrivers-parlay-insurance',
    bookmaker: 'betrivers',
    bookmakerDisplayName: 'BetRivers',
    title: 'Parlay Insurance (4+ legs)',
    description:
      'Get your stake back as a free bet if one leg of your 4+ leg parlay loses on select NBA/NFL days',
    category: PROMO_CATEGORIES.ACTIVE_USER,
    type: PROMO_TYPES.PARLAY_INSURANCE,
    value: 'Free bet refund (4+ leg parlay)',
    link: 'https://www.betrivers.com/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== CAESARS DAILY ==========
  {
    id: 'caesars-daily-boosts',
    bookmaker: 'caesars',
    bookmakerDisplayName: 'Caesars Sportsbook',
    title: 'Daily Odds Boosts',
    description:
      'Curated daily boosts on NFL/NBA/NHL/MLB that enhance payouts on marquee bets (Super Boosts)',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.ODDS_BOOST,
    value: 'Daily boosted odds',
    link: 'https://www.caesars.com/sportsbook-promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== DAILY PROMOTIONS ==========
  {
    id: 'fanduel-holiday-wildcard',
    bookmaker: 'fanduel',
    bookmakerDisplayName: 'FanDuel',
    title: 'Daily Holiday Wildcard Reward',
    description:
      'Daily opt-in during the holidays to reveal mystery rewards: bonus bets, profit boosts, or odds boosts',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.OTHER,
    value: 'Mystery daily rewards',
    link: 'https://sportsbook.fanduel.com/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'fanduel-nba-happy-hour',
    bookmaker: 'fanduel',
    bookmakerDisplayName: 'FanDuel',
    title: 'NBA Happy Hour Profit Boosts',
    description:
      'Friday NBA happy hour issues profit boost tokens (25%-50%) for same-game parlays placed that evening',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.PROFIT_BOOST,
    sport: PROMO_SPORTS.NBA,
    value: '25%-50% profit boosts',
    link: 'https://sportsbook.fanduel.com/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'draftkings-mystery-friday',
    bookmaker: 'draftkings',
    bookmakerDisplayName: 'DraftKings',
    title: 'Mystery Boost Friday',
    description:
      'Weekly mystery promo (e.g., NBA Friday Magic) giving random boosts or bonus bets upon opting in',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.OTHER,
    value: 'Random daily boost',
    link: 'https://sportsbook.draftkings.com/promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'draftkings-all-sport-boost',
    bookmaker: 'draftkings',
    bookmakerDisplayName: 'DraftKings',
    title: 'All-Sport Profit Boost Token',
    description:
      'Rotating universal boost (+30% profit) usable on any parlay or same-game parlay across sports for the week',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.PROFIT_BOOST,
    value: '+30% profit boost',
    link: 'https://sportsbook.draftkings.com/promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'bet365-holiday-hot-streak',
    bookmaker: 'bet365',
    bookmakerDisplayName: 'bet365',
    title: 'Holiday Hot Streak Daily Challenges',
    description:
      'Daily December challenges with rotating rewards: free bets, profit boosts, or live bet incentives',
    category: PROMO_CATEGORIES.SEASONAL,
    type: PROMO_TYPES.OTHER,
    value: 'Daily challenges through 12/31',
    link: 'https://us.bet365.com/#/promotions',
    expiresAt: '2025-12-31T23:59:59Z',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betmgm-parlay-boost-token',
    bookmaker: 'betmgm',
    bookmakerDisplayName: 'BetMGM',
    title: 'Daily Parlay Boost Tokens',
    description:
      'Parlay Profit Boost tokens refresh regularly (e.g., 40% boost) and can be applied to any multi-leg parlay',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.PROFIT_BOOST,
    value: 'Up to 40% parlay boost',
    link: 'https://www.betmgm.com/en/promo/offers',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betrivers-daily-profit-boost',
    bookmaker: 'betrivers',
    bookmakerDisplayName: 'BetRivers',
    title: 'Daily Profit Boosts',
    description:
      'Daily boost tokens (20%-50%) on select sports (e.g., NBA Tuesday, NHL Thursday) with same-day usage',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.PROFIT_BOOST,
    value: '20%-50% profit boosts',
    link: 'https://www.betrivers.com/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'pointsbet-power-hour',
    bookmaker: 'pointsbet',
    bookmakerDisplayName: 'PointsBet',
    title: 'Power Hour Reward Points Boost',
    description:
      'Daily “Power Hour” where wagers earn double reward points to unlock bonus bets faster',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.LOYALTY_PROGRAM,
    value: 'Double reward points',
    link: 'https://pointsbet.com/promos',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'caesars-rewards-tier-boost',
    bookmaker: 'caesars',
    bookmakerDisplayName: 'Caesars Sportsbook',
    title: 'Caesars Rewards Tier Credit Boosts',
    description:
      'Occasional daily promos doubling Caesars Rewards credits on selected bets (e.g., 2x on NBA tonight)',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.LOYALTY_PROGRAM,
    value: 'Double reward points',
    link: 'https://www.caesars.com/sportsbook',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== REGIONAL / SEASONAL ==========
  {
    id: 'desert-diamond-quarterfinal-countdown',
    bookmaker: 'desertdiamond',
    bookmakerDisplayName: 'Desert Diamond Sports',
    title: 'Quarterfinal Countdown (NCAAF)',
    description:
      'Bowl-day wagers (Dec 31–Jan 1) earn entries into halftime and postgame cash drawings for Rose and Sugar Bowls',
    category: PROMO_CATEGORIES.SEASONAL,
    type: PROMO_TYPES.OTHER,
    sport: PROMO_SPORTS.NCAAF,
    value: 'Daily cash drawings during playoffs',
    link: 'https://www.ddcaz.com/white-tanks/gaming/sportsbook',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'action247-titans-free-contest',
    bookmaker: 'action247',
    bookmakerDisplayName: 'Action 24/7',
    title: 'Titans Game Free Contest',
    description:
      'Weekly free-to-play NFL contests (e.g., Titans Challenge) with small cash prize pools for perfect picks',
    category: PROMO_CATEGORIES.ACTIVE_USER,
    type: PROMO_TYPES.OTHER,
    sport: PROMO_SPORTS.NFL,
    value: '$100–$250 cash pools',
    link: 'https://playtenn.com',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betsaracen-razorbacks-specials',
    bookmaker: 'betsaracen',
    bookmakerDisplayName: 'BetSaracen',
    title: 'Razorbacks Specials',
    description:
      'Arkansas-only offers on Razorbacks games such as odds boosts or refunds tied to rivalry matchups',
    category: PROMO_CATEGORIES.SPORT_SPECIFIC,
    type: PROMO_TYPES.OTHER,
    sport: PROMO_SPORTS.NCAAF,
    link: 'https://sportsbook.betsaracen.com/en-us/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== REGIONAL DAILY PROMOS ==========
  {
    id: 'desert-diamond-wager-weekdays',
    bookmaker: 'desertdiamond',
    bookmakerDisplayName: 'Desert Diamond Sports',
    title: 'Wager on Weekdays Reward',
    description:
      'Place $50+ on weekdays and redeem a $5 dining voucher (limit 2 per day) at Desert Diamond casinos',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.CASHBACK,
    value: '$5 dining voucher per $50 wager',
    link: 'https://www.ddcaz.com/white-tanks/gaming/sportsbook',
    states: ['AZ'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betsaracen-parlay-boost',
    bookmaker: 'betsaracen',
    bookmakerDisplayName: 'BetSaracen',
    title: 'Automatic 10% Parlay Boost',
    description:
      'Arkansas boost that automatically adds 10% extra winnings on 3+ leg parlays (no opt-in required)',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.PROFIT_BOOST,
    value: '10% parlay boost',
    link: 'https://sportsbook.betsaracen.com/en-us/promotions',
    states: ['AR'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'oaklawn-daily-challenges',
    bookmaker: 'oaklawn',
    bookmakerDisplayName: 'Oaklawn Sports',
    title: 'Daily Challenges & Giveaways',
    description:
      'Leaderboard challenges, missions, and free spins that award bonus bets or prizes each day',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.OTHER,
    link: 'https://oaklawnsports.com/promotions.shtml',
    states: ['AR'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betly-redzone-riches',
    bookmaker: 'betly',
    bookmakerDisplayName: 'Betly Sportsbook',
    title: 'Redzone Riches NFL Promo',
    description:
      'NFL Sunday promo where qualifying bets earn bonus credits if red zone events trigger during the game',
    category: PROMO_CATEGORIES.DAILY,
    type: PROMO_TYPES.OTHER,
    sport: PROMO_SPORTS.NFL,
    states: ['AR', 'WV'],
    value: 'Bonus bet credits based on red zone action',
    link: 'https://ar.betly.com/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== NEW USER PROMOS ==========
  {
    id: 'desert-diamond-bet20-get100',
    bookmaker: 'desertdiamond',
    bookmakerDisplayName: 'Desert Diamond Sports',
    title: 'Bet $20, Get $100 (AZ)',
    description:
      'New Arizona bettors place $20+ to receive $100 in bonus bets (issued as four $25 tokens)',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$100',
    minBet: 20,
    link: 'https://www.betarizona.com/sports-betting/desert-diamond',
    states: ['AZ'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betsaracen-bet25-get125',
    bookmaker: 'betsaracen',
    bookmakerDisplayName: 'BetSaracen',
    title: 'Bet $25, Get $125 (AR)',
    description:
      'Register with code WELCOME, place $25, and receive five $25 bonus bet tokens instantly',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$125',
    minBet: 25,
    promoCode: 'WELCOME',
    states: ['AR'],
    link: 'https://sportsbook.betsaracen.com/en-us/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'betly-first-bet-insurance',
    bookmaker: 'betly',
    bookmakerDisplayName: 'Betly Sportsbook',
    title: 'First Bet Insurance (AR/WV)',
    description:
      'If your first bet loses, receive up to $100 (AR) or $200 (WV) back in bonus credit within 72 hrs',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.RISK_FREE_BET,
    value: '$100–$200 insurance',
    states: ['AR', 'WV'],
    link: 'https://ar.betly.com/promotions',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'oaklawn-second-chance',
    bookmaker: 'oaklawn',
    bookmakerDisplayName: 'Oaklawn Sports',
    title: 'Up to $1,000 Second-Chance Bets',
    description:
      'New bettors get insurance on their first bet each day for 10 days (max $100 back per day)',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.RISK_FREE_BET,
    value: 'Up to $1,000 back (10 days)',
    link: 'https://oaklawnsports.com',
    states: ['AR'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'action247-choose-your-own',
    bookmaker: 'action247',
    bookmakerDisplayName: 'Action 24/7',
    title: 'Choose Your Own Sign-Up Bonus',
    description:
      'Pick FREE50 (get $50 after $20 bet) or FREEWEEK (7 days of bet insurance up to $100) on sign-up',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.OTHER,
    value: '$50 or 7-day insurance',
    promoCode: 'FREE50 / FREEWEEK',
    link: 'https://www.action247.com',
    states: ['TN'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'si-sportsbook-bet20-win200',
    bookmaker: 'si',
    bookmakerDisplayName: 'SI Sportsbook',
    title: 'Bet $20, Win $200 Bonus',
    description:
      'Bet $20+; if it wins, receive $200 in bonus bets (paid as eight $25 tokens)',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.BONUS_BETS,
    value: '$200',
    minBet: 20,
    link: 'https://www.si.com/betting/si-sportsbook-promo',
    states: ['CO', 'VA'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'thescorebet-dual-welcome',
    bookmaker: 'thescorebet',
    bookmakerDisplayName: 'theScore Bet',
    title: '$1,500 Dual Welcome Bonus',
    description:
      '200% deposit match up to $500 plus “First Bet Reset” up to $1,000 (bonus funds expire in 7 days)',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.DEPOSIT_MATCH,
    value: '$1,500 total',
    link: 'https://www.thescore.bet/',
    states: ['AZ', 'CO', 'DC', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'MD', 'MA', 'MI', 'MO', 'NC', 'NJ', 'NY', 'OH', 'PA', 'TN', 'VA', 'WV'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },
  {
    id: 'crab-sports-md-100-boost',
    bookmaker: 'crabsports',
    bookmakerDisplayName: 'Crab Sports',
    title: 'MD First-Bet 100% Profit Boost',
    description:
      'Insert code PLAYMD and get a 100% profit boost (up to $500) on your first bet if it wins, or a full bonus bet if it loses',
    category: PROMO_CATEGORIES.NEW_USER,
    type: PROMO_TYPES.PROFIT_BOOST,
    value: '100% profit boost up to $500',
    minBet: 25,
    states: ['MD'],
    link: 'https://www.crabsports.com/',
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
  },

  // ========== PROPHEt EXCHANGE PEER-TO-PEER ==========
  {
    id: 'prophetx-deposit-match',
    bookmaker: 'prophetx',
    bookmakerDisplayName: 'Prophet Exchange',
    title: '20% Deposit Match (P2P Exchange)',
    description:
      'New NJ/IN users receive a 20% deposit match (up to $100) in Prophet Cash on the peer-to-peer exchange',
    category: PROMO_CATEGORIES.PEER_TO_PEER,
    type: PROMO_TYPES.DEPOSIT_MATCH,
    value: '20% match up to $100',
    link: 'https://www.prophetx.co/promotions',
    states: ['NJ', 'IN'],
    createdAt: '2025-12-22T00:00:00Z',
    updatedAt: '2025-12-22T00:00:00Z',
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
    [PROMO_CATEGORIES.DAILY]: promos.filter(p => p.category === PROMO_CATEGORIES.DAILY),
    [PROMO_CATEGORIES.PEER_TO_PEER]: promos.filter(p => p.category === PROMO_CATEGORIES.PEER_TO_PEER),
  }
}
