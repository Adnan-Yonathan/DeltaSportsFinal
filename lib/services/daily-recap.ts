import { createServiceClient } from '@/lib/supabase/service'
import { calculatePotentialWin } from '@/lib/utils/odds'
import { fetchAllLiveScores, type LiveScoreGame } from '@/lib/live-scores'

// Types
export type PickResult = 'win' | 'loss' | 'push' | 'pending'
export type CLVTier = 'negligible' | 'good' | 'elite' | 'godlike'

export type DailyRecapPick = {
  id: string
  sport: string
  marketType: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  pickSide: 'home' | 'away'
  pickLine: number | null
  pickOdds: number | null
  homeScore: number | null
  awayScore: number | null
  result: PickResult
  clvPoints: number | null
}

export type DailyRecap = {
  id: string
  recapDate: string
  sports: string[]
  totalPicks: number
  wins: number
  losses: number
  pushes: number
  roiPercent: number | null
  avgClvPoints: number | null
  clvTier: CLVTier | null
  hypothetical100Profit: number | null
  picks: DailyRecapPick[]
  createdAt: string
}

type MarketProjectionClvRow = {
  id: string
  sport: string
  market_type: string
  home_team: string
  away_team: string
  commence_time: string
  pick_side: 'home' | 'away'
  pick_line: number | null
  pick_odds: number | null
  home_score: number | null
  away_score: number | null
  result: PickResult | null
  clv_points: number | null
}

type DailyRecapRow = {
  id: string
  recap_date: string
  sports: string[]
  total_picks: number
  wins: number
  losses: number
  pushes: number
  roi_percent: number | null
  avg_clv_points: number | null
  clv_tier: CLVTier | null
  hypothetical_100_profit: number | null
  picks: DailyRecapPick[]
  created_at: string
}

// Configuration for supported sports and markets
type ResultCalculator = (
  pickSide: 'home' | 'away',
  pickLine: number | null,
  homeScore: number,
  awayScore: number
) => PickResult

type RecapSportConfig = {
  markets: string[]
  resultCalculators: Record<string, ResultCalculator>
  oddsApiSport: string
  espnLeague: string
}

export const RECAP_CONFIG: Record<string, RecapSportConfig> = {
  basketball_nba: {
    markets: ['spread', 'moneyline', 'total'],
    resultCalculators: {
      spread: calculateSpreadResult,
      moneyline: calculateMoneylineResult,
    },
    oddsApiSport: 'basketball_nba',
    espnLeague: 'nba',
  },
  basketball_ncaab: {
    markets: ['spread'],
    resultCalculators: {
      spread: calculateSpreadResult,
    },
    oddsApiSport: 'basketball_ncaab',
    espnLeague: 'ncaab',
  },
  icehockey_nhl: {
    markets: ['moneyline'],
    resultCalculators: {
      moneyline: calculateMoneylineResult,
    },
    oddsApiSport: 'icehockey_nhl',
    espnLeague: 'nhl',
  },
}

// CLV Tier mapping
export function getClvTier(avgClv: number): CLVTier {
  if (avgClv >= 0.9) return 'godlike'
  if (avgClv >= 0.6) return 'elite'
  if (avgClv >= 0.3) return 'good'
  return 'negligible'
}

export function getClvTierLabel(tier: CLVTier): string {
  switch (tier) {
    case 'godlike':
      return 'God-like'
    case 'elite':
      return 'Elite'
    case 'good':
      return 'Good'
    case 'negligible':
      return 'Negligible'
  }
}

// Spread result calculation
export function calculateSpreadResult(
  pickSide: 'home' | 'away',
  pickLine: number | null,
  homeScore: number,
  awayScore: number
): PickResult {
  if (pickLine == null) return 'pending'
  const margin = homeScore - awayScore
  // For home pick with line -3.5: home wins by 4 = win (4 + -3.5 = 0.5 > 0)
  // For away pick with line +3.5: away loses by 3 = win (-3 + 3.5 = 0.5 > 0)
  const adjustedMargin = pickSide === 'home' ? margin + pickLine : -margin - pickLine
  if (adjustedMargin > 0) return 'win'
  if (adjustedMargin < 0) return 'loss'
  return 'push'
}

// Moneyline result calculation
export function calculateMoneylineResult(
  pickSide: 'home' | 'away',
  _pickLine: number | null,
  homeScore: number,
  awayScore: number
): PickResult {
  if (homeScore === awayScore) return 'push'
  const homeWon = homeScore > awayScore
  if (pickSide === 'home') return homeWon ? 'win' : 'loss'
  return homeWon ? 'loss' : 'win'
}

// Calculate hypothetical $100 bettor profit
export function calculateHypothetical100Profit(
  picks: Array<{ result: PickResult; pickOdds: number | null }>
): number {
  return picks.reduce((total, pick) => {
    if (pick.pickOdds == null) return total
    if (pick.result === 'win') return total + calculatePotentialWin(100, pick.pickOdds)
    if (pick.result === 'loss') return total - 100
    return total // push
  }, 0)
}

// Normalize team name for matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Find matching ESPN game for a pick
function findMatchingGame(
  pick: { homeTeam: string; awayTeam: string; commenceTime: string },
  games: LiveScoreGame[]
): LiveScoreGame | null {
  const pickHomeNorm = normalizeTeamName(pick.homeTeam)
  const pickAwayNorm = normalizeTeamName(pick.awayTeam)
  const pickTime = new Date(pick.commenceTime).getTime()

  for (const game of games) {
    const homeComp = game.competitors.find((c) => c.homeAway === 'home')
    const awayComp = game.competitors.find((c) => c.homeAway === 'away')
    if (!homeComp || !awayComp) continue

    const gameHomeNorm = normalizeTeamName(homeComp.name)
    const gameAwayNorm = normalizeTeamName(awayComp.name)
    const gameTime = new Date(game.startTime).getTime()

    // Check if team names match (allowing for partial matches)
    const homeMatch =
      gameHomeNorm.includes(pickHomeNorm) ||
      pickHomeNorm.includes(gameHomeNorm) ||
      normalizeTeamName(homeComp.shortName).includes(pickHomeNorm) ||
      pickHomeNorm.includes(normalizeTeamName(homeComp.shortName))

    const awayMatch =
      gameAwayNorm.includes(pickAwayNorm) ||
      pickAwayNorm.includes(gameAwayNorm) ||
      normalizeTeamName(awayComp.shortName).includes(pickAwayNorm) ||
      pickAwayNorm.includes(normalizeTeamName(awayComp.shortName))

    // Check if times are within 4 hours
    const timeDiff = Math.abs(pickTime - gameTime)
    const timeMatch = timeDiff < 4 * 60 * 60 * 1000

    if (homeMatch && awayMatch && timeMatch) {
      return game
    }
  }

  return null
}

// Settle pick results for a given date
export async function settlePickResults(
  date: string,
  options?: { sports?: string[] }
) {
  const supabase = createServiceClient()
  const marketProjectionClv = supabase.from('market_projection_clv' as any) as any
  const sports = options?.sports ?? Object.keys(RECAP_CONFIG)

  // Fetch completed games from ESPN for the date
  const { games } = await fetchAllLiveScores({
    date,
    includeCompletedForDate: true,
  })

  const completedGames = games.filter((g) => g.bucket === 'completed')
  console.log(`[daily-recap] Found ${completedGames.length} completed games for ${date}`)

  // Fetch pending picks for the date
  const startOfDay = `${date}T00:00:00Z`
  const endOfDay = `${date}T23:59:59Z`

  const { data: pendingPicks, error } = (await marketProjectionClv
    .select('*')
    .in('sport', sports)
    .gte('commence_time', startOfDay)
    .lte('commence_time', endOfDay)
    .or('result.is.null,result.eq.pending')) as {
    data: MarketProjectionClvRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.error('[daily-recap] Failed to fetch pending picks:', error)
    return { settled: 0 }
  }

  if (!pendingPicks?.length) {
    console.log('[daily-recap] No pending picks to settle')
    return { settled: 0 }
  }

  let settledCount = 0

  for (const pick of pendingPicks) {
    const sportConfig = RECAP_CONFIG[pick.sport]
    if (!sportConfig) continue

    // Find matching ESPN game
    const game = findMatchingGame(
      {
        homeTeam: pick.home_team,
        awayTeam: pick.away_team,
        commenceTime: pick.commence_time,
      },
      completedGames.filter((g) => g.league === sportConfig.espnLeague)
    )

    if (!game) {
      console.log(`[daily-recap] No matching game found for ${pick.away_team} @ ${pick.home_team}`)
      continue
    }

    const homeComp = game.competitors.find((c) => c.homeAway === 'home')
    const awayComp = game.competitors.find((c) => c.homeAway === 'away')
    if (!homeComp || !awayComp) continue

    const homeScore = homeComp.score
    const awayScore = awayComp.score

    // Get the result calculator for this market type
    const calculator = sportConfig.resultCalculators[pick.market_type]
    if (!calculator) {
      console.log(`[daily-recap] No calculator for market ${pick.market_type}`)
      continue
    }

    const result = calculator(pick.pick_side, pick.pick_line, homeScore, awayScore)

    // Update the pick with scores and result
    const { error: updateError } = await marketProjectionClv.update({
        home_score: homeScore,
        away_score: awayScore,
        result,
        result_settled_at: new Date().toISOString(),
      })
      .eq('id', pick.id)

    if (updateError) {
      console.error(`[daily-recap] Failed to update pick ${pick.id}:`, updateError)
      continue
    }

    settledCount++
    console.log(
      `[daily-recap] Settled: ${pick.away_team} @ ${pick.home_team} -> ${result} (${awayScore}-${homeScore})`
    )
  }

  return { settled: settledCount }
}

// Generate daily recap for a given date
export async function generateDailyRecap(
  date: string,
  options?: { sports?: string[]; markets?: string[] }
) {
  const supabase = createServiceClient()
  const marketProjectionClv = supabase.from('market_projection_clv' as any) as any
  const sports = options?.sports ?? Object.keys(RECAP_CONFIG)

  const startOfDay = `${date}T00:00:00Z`
  const endOfDay = `${date}T23:59:59Z`

  // Fetch settled picks for the date
  const { data: picks, error } = (await marketProjectionClv
    .select('*')
    .in('sport', sports)
    .gte('commence_time', startOfDay)
    .lte('commence_time', endOfDay)
    .in('result', ['win', 'loss', 'push'])) as {
    data: MarketProjectionClvRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.error('[daily-recap] Failed to fetch picks:', error)
    return null
  }

  if (!picks?.length) {
    console.log('[daily-recap] No settled picks for date:', date)
    return null
  }

  // Apply market filter if provided
  const filteredPicks = options?.markets
    ? picks.filter((p) => options.markets!.includes(p.market_type))
    : picks

  if (!filteredPicks.length) {
    return null
  }

  // Calculate stats
  const wins = filteredPicks.filter((p) => p.result === 'win').length
  const losses = filteredPicks.filter((p) => p.result === 'loss').length
  const pushes = filteredPicks.filter((p) => p.result === 'push').length
  const totalPicks = filteredPicks.length

  // Calculate ROI
  const unitsWon = wins
  const unitsLost = losses
  const netUnits = unitsWon - unitsLost
  const roiPercent = totalPicks > 0 ? (netUnits / totalPicks) * 100 : null

  // Calculate average CLV
  const clvValues = filteredPicks
    .map((p) => p.clv_points)
    .filter((v): v is number => v != null)
  const avgClvPoints =
    clvValues.length > 0
      ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length
      : null
  const clvTier = avgClvPoints != null ? getClvTier(avgClvPoints) : null

  // Calculate hypothetical $100 bettor profit
  const hypothetical100Profit = calculateHypothetical100Profit(
    filteredPicks.map((p) => ({
      result: p.result as PickResult,
      pickOdds: p.pick_odds,
    }))
  )

  // Get unique sports
  const uniqueSports = Array.from(new Set(filteredPicks.map((p) => p.sport)))
  const sportLabels = uniqueSports.map((s) => {
    if (s === 'basketball_nba') return 'NBA'
    if (s === 'basketball_ncaab') return 'NCAAB'
    if (s === 'icehockey_nhl') return 'NHL'
    return s
  })

  // Format picks for storage
  const formattedPicks: DailyRecapPick[] = filteredPicks.map((p) => ({
    id: p.id,
    sport: p.sport,
    marketType: p.market_type,
    homeTeam: p.home_team,
    awayTeam: p.away_team,
    commenceTime: p.commence_time,
    pickSide: p.pick_side,
    pickLine: p.pick_line,
    pickOdds: p.pick_odds,
    homeScore: p.home_score,
    awayScore: p.away_score,
    result: p.result as PickResult,
    clvPoints: p.clv_points,
  }))

  const recap = {
    recap_date: date,
    sports: sportLabels,
    total_picks: totalPicks,
    wins,
    losses,
    pushes,
    roi_percent: roiPercent != null ? Math.round(roiPercent * 100) / 100 : null,
    avg_clv_points: avgClvPoints != null ? Math.round(avgClvPoints * 100) / 100 : null,
    clv_tier: clvTier,
    hypothetical_100_profit:
      hypothetical100Profit != null
        ? Math.round(hypothetical100Profit * 100) / 100
        : null,
    picks: formattedPicks,
  }

  console.log('[daily-recap] Generated recap:', {
    date,
    record: `${wins}-${losses}-${pushes}`,
    roi: recap.roi_percent,
    avgClv: recap.avg_clv_points,
    tier: recap.clv_tier,
    profit: recap.hypothetical_100_profit,
  })

  return recap
}

// Upsert daily recap to database
export async function upsertDailyRecap(
  recap: Awaited<ReturnType<typeof generateDailyRecap>>
) {
  if (!recap) return null

  const supabase = createServiceClient()
  const dailyRecaps = supabase.from('daily_recaps' as any) as any

  const { data, error } = (await dailyRecaps
    .upsert(recap as any, {
      onConflict: 'recap_date',
    })
    .select()
    .single()) as {
    data: DailyRecapRow | null
    error: { code?: string; message?: string } | null
  }

  if (error) {
    console.error('[daily-recap] Failed to upsert recap:', error)
    return null
  }

  return data
}

// Get latest daily recap
export async function getLatestDailyRecap(): Promise<DailyRecap | null> {
  const supabase = createServiceClient()
  const dailyRecaps = supabase.from('daily_recaps' as any) as any

  const { data, error } = (await dailyRecaps
    .select('*')
    .order('recap_date', { ascending: false })
    .limit(1)
    .single()) as {
    data: DailyRecapRow | null
    error: { code?: string; message?: string } | null
  }

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[daily-recap] Failed to fetch latest recap:', error)
    }
    return null
  }

  if (!data) return null

  return {
    id: data.id,
    recapDate: data.recap_date,
    sports: data.sports,
    totalPicks: data.total_picks,
    wins: data.wins,
    losses: data.losses,
    pushes: data.pushes,
    roiPercent: data.roi_percent,
    avgClvPoints: data.avg_clv_points,
    clvTier: data.clv_tier,
    hypothetical100Profit: data.hypothetical_100_profit,
    picks: data.picks,
    createdAt: data.created_at,
  }
}

// Get recap for a specific date
export async function getDailyRecap(date: string): Promise<DailyRecap | null> {
  const supabase = createServiceClient()
  const dailyRecaps = supabase.from('daily_recaps' as any) as any

  const { data, error } = (await dailyRecaps
    .select('*')
    .eq('recap_date', date)
    .single()) as {
    data: DailyRecapRow | null
    error: { code?: string; message?: string } | null
  }

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[daily-recap] Failed to fetch recap:', error)
    }
    return null
  }

  if (!data) return null

  return {
    id: data.id,
    recapDate: data.recap_date,
    sports: data.sports,
    totalPicks: data.total_picks,
    wins: data.wins,
    losses: data.losses,
    pushes: data.pushes,
    roiPercent: data.roi_percent,
    avgClvPoints: data.avg_clv_points,
    clvTier: data.clv_tier,
    hypothetical100Profit: data.hypothetical_100_profit,
    picks: data.picks,
    createdAt: data.created_at,
  }
}
