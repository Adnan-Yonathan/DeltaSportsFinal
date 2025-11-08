// Utility functions for odds calculations

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1
  } else {
    return (100 / Math.abs(americanOdds)) + 1
  }
}

/**
 * Convert decimal odds to American odds
 */
export function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100)
  } else {
    return Math.round(-100 / (decimalOdds - 1))
  }
}

/**
 * Calculate implied probability from American odds
 */
export function impliedProbability(americanOdds: number): number {
  const decimal = americanToDecimal(americanOdds)
  return (1 / decimal) * 100
}

/**
 * Calculate potential profit from a bet
 */
export function calculatePotentialWin(stake: number, americanOdds: number): number {
  const decimal = americanToDecimal(americanOdds)
  return stake * (decimal - 1)
}

/**
 * Calculate total payout (stake + profit)
 */
export function calculatePayout(stake: number, americanOdds: number): number {
  return stake + calculatePotentialWin(stake, americanOdds)
}

/**
 * Format American odds with + or - sign
 */
export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

/**
 * Calculate the stakes needed for an arbitrage bet
 */
export function calculateArbitrageStakes(
  totalStake: number,
  odds1: number,
  odds2: number
): { stake1: number; stake2: number; profit: number; profitPercent: number } {
  const decimal1 = americanToDecimal(odds1)
  const decimal2 = americanToDecimal(odds2)

  const stake1 = totalStake / (1 + (decimal1 / decimal2))
  const stake2 = totalStake - stake1

  const payout1 = stake1 * decimal1
  const payout2 = stake2 * decimal2

  const profit = Math.min(payout1, payout2) - totalStake
  const profitPercent = (profit / totalStake) * 100

  return {
    stake1: Math.round(stake1 * 100) / 100,
    stake2: Math.round(stake2 * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    profitPercent: Math.round(profitPercent * 100) / 100,
  }
}

/**
 * Check if two bets create an arbitrage opportunity
 */
export function isArbitrage(odds1: number, odds2: number): boolean {
  const decimal1 = americanToDecimal(odds1)
  const decimal2 = americanToDecimal(odds2)
  const totalImpliedProb = (1 / decimal1) + (1 / decimal2)
  return totalImpliedProb < 1
}

/**
 * Calculate Closing Line Value (CLV)
 */
export function calculateCLV(betOdds: number, closingOdds: number): number {
  const betImplied = impliedProbability(betOdds)
  const closingImplied = impliedProbability(closingOdds)
  return closingImplied - betImplied
}

/**
 * Calculate ROI from bets
 */
export function calculateROI(totalStake: number, totalProfit: number): number {
  if (totalStake === 0) return 0
  return (totalProfit / totalStake) * 100
}

/**
 * Calculate Kelly Criterion bet size
 */
export function kellyCalculator(
  bankroll: number,
  odds: number,
  estimatedWinProbability: number,
  kellyFraction: number = 1
): number {
  const decimal = americanToDecimal(odds)
  const b = decimal - 1 // net odds received
  const p = estimatedWinProbability / 100
  const q = 1 - p

  const kelly = (b * p - q) / b
  const kellyPercent = Math.max(0, kelly * 100) * kellyFraction

  return (bankroll * kellyPercent) / 100
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}
