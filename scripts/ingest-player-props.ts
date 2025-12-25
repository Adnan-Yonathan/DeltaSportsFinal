/**
 * Capture live player prop lines via SportsBettingDime gameprops feed.
 * Run with:
 *   npx ts-node --project tsconfig.scripts.json scripts/ingest-player-props.ts
 */

import 'dotenv/config'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchSbdGamePropsList, resolveSbdLeague, resolveSportKey, formatBookmaker } from '@/lib/api/sbd'

const SPORT_PROP_MARKETS: Record<string, string[]> = {
  basketball_nba: ['points', 'rebounds', 'assists', 'threes'],
  baseball_mlb: ['hits', 'total_bases', 'rbis', 'runs'],
  icehockey_nhl: ['points', 'shots_on_goal', 'blocked_shots'],
}

const NFL_PROP_MARKETS_BY_POSITION: Record<string, string[]> = {
  QB: [
    'passing_yards',
    'passing_completions',
    'passing_attempts',
    'passing_touchdowns',
    'interceptions',
    'rushing_yards',
    'rushing_touchdowns',
    'anytime_td',
  ],
  RB: [
    'rushing_yards',
    'rushing_touchdowns',
    'receiving_yards',
    'receptions',
    'receiving_touchdowns',
    'anytime_td',
  ],
  WR: [
    'receiving_yards',
    'receptions',
    'receiving_touchdowns',
    'anytime_td',
  ],
  TE: [
    'receiving_yards',
    'receptions',
    'receiving_touchdowns',
    'anytime_td',
  ],
  DEFAULT: [
    'passing_yards',
    'passing_completions',
    'passing_attempts',
    'passing_touchdowns',
    'interceptions',
    'rushing_yards',
    'rushing_touchdowns',
    'receiving_yards',
    'receptions',
    'receiving_touchdowns',
    'anytime_td',
  ],
}

type PropEntry = {
  sport_key: string
  event_id: string
  player_name: string
  team_name?: string | null
  market_key: string
  line: number | null
  over_odds: number | null
  under_odds: number | null
  book: string
  captured_at: string
}

const normalizeMarketKey = (value: string): string => {
  const cleaned = value.toLowerCase().replace(/\(.*?\)/g, '').trim()
  if (cleaned.includes('points plus assists plus rebounds')) return 'pra'
  if (cleaned.includes('points plus rebounds')) return 'points_rebounds'
  if (cleaned.includes('points plus assists')) return 'points_assists'
  if (cleaned.includes('rebounds plus assists')) return 'rebounds_assists'
  if (cleaned.includes('blocks plus steals')) return 'blocks_steals'
  if (cleaned.includes('3-point')) return 'threes'
  if (cleaned.includes('passing completions')) return 'passing_completions'
  if (cleaned.includes('passing attempts')) return 'passing_attempts'
  if (cleaned.includes('passing yards')) return 'passing_yards'
  if (cleaned.includes('passing tds') || cleaned.includes('passing touchdowns')) return 'passing_touchdowns'
  if (cleaned.includes('interceptions')) return 'interceptions'
  if (cleaned.includes('rushing yards')) return 'rushing_yards'
  if (cleaned.includes('rushing tds') || cleaned.includes('rushing touchdowns')) return 'rushing_touchdowns'
  if (cleaned.includes('receiving yards')) return 'receiving_yards'
  if (cleaned.includes('receiving tds') || cleaned.includes('receiving touchdowns')) return 'receiving_touchdowns'
  if (cleaned.includes('receptions')) return 'receptions'
  if (cleaned.includes('anytime touchdown')) return 'anytime_td'
  if (cleaned.includes('anytime td')) return 'anytime_td'
  if (cleaned.includes('points')) return 'points'
  if (cleaned.includes('rebounds')) return 'rebounds'
  if (cleaned.includes('assists')) return 'assists'
  if (cleaned.includes('steals')) return 'steals'
  if (cleaned.includes('blocks')) return 'blocks'
  return cleaned.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

const resolveNflAllowedMarkets = (entry: any): string[] => {
  const position =
    entry?.player?.position?.abbreviation ||
    entry?.player?.position ||
    entry?.position ||
    ''
  const normalized = String(position).toUpperCase().trim()
  return NFL_PROP_MARKETS_BY_POSITION[normalized] || NFL_PROP_MARKETS_BY_POSITION.DEFAULT
}

const parseOddsValue = (value: any): number | null => {
  if (value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed > 1 && parsed < 10) {
    if (parsed >= 2) return Math.round((parsed - 1) * 100)
    return Math.round(-100 / (parsed - 1))
  }
  return Math.round(parsed)
}

const parseLineValue = (value: any): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function capturePlayerProps() {
  const supabase = createServiceClient()
  const captured_at = new Date().toISOString()

  const sportEntries: Array<[string, string[]]> = [
    ...Object.entries(SPORT_PROP_MARKETS),
    ['americanfootball_nfl', []],
  ]

  for (const [sportKey, markets] of sportEntries) {
    const league = resolveSbdLeague(sportKey)
    if (!league) {
      console.warn(`[PROPS] No SBD league for ${sportKey}, skipping`)
      continue
    }

    console.log(`[PROPS] Fetching ${sportKey} props from SBD (${league})`)
    const payload = await fetchSbdGamePropsList(league as any, { limit: 2500 })
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
    const rows: PropEntry[] = []
    const propMap = new Map<string, PropEntry>()
    const sport_key = resolveSportKey(league) || sportKey

    for (const entry of items) {
      const playerName = entry?.player_name || entry?.player?.name
      if (!playerName) continue
      const marketKey = normalizeMarketKey(entry?.name || '')
      const allowedMarkets =
        sportKey === 'americanfootball_nfl'
          ? resolveNflAllowedMarkets(entry)
          : markets
      if (allowedMarkets.length && !allowedMarkets.includes(marketKey)) continue

      const eventId = String(entry?.sport_event?.id || entry?.sport_event || entry?.sde_id || '')
      if (!eventId) continue

      const line = parseLineValue(
        entry?.sportsbooks?.[0]?.odds?.over_points ??
          entry?.sportsbooks?.[0]?.odds?.under_points ??
          entry?.sportsbooks?.[0]?.over_points ??
          entry?.sportsbooks?.[0]?.under_points
      )

      for (const sportsbook of entry?.sportsbooks || []) {
        const name = String(sportsbook?.name || '')
        if (!name || name.toLowerCase() === 'consensus') continue
        const formatted = formatBookmaker(name)
        const odds = sportsbook?.odds || {}
        const overOdds = parseOddsValue(odds?.over_american ?? odds?.over_decimal ?? sportsbook?.over_odds)
        const underOdds = parseOddsValue(odds?.under_american ?? odds?.under_decimal ?? sportsbook?.under_odds)

        const key = [
          sport_key,
          eventId,
          formatted.title,
          marketKey,
          playerName,
        ].join('|')

        if (!propMap.has(key)) {
          propMap.set(key, {
            sport_key,
            event_id: eventId,
            player_name: playerName,
            team_name: entry?.player?.team || null,
            market_key: `player_${marketKey}`,
            line,
            over_odds: null,
            under_odds: null,
            book: formatted.title,
            captured_at,
          })
        }

        const row = propMap.get(key)!
        if (line != null) row.line = line
        if (overOdds != null) row.over_odds = overOdds
        if (underOdds != null) row.under_odds = underOdds
      }
    }

    rows.push(...propMap.values())

    if (!rows.length) {
      console.log(`[PROPS] No prop rows captured for ${sportKey}`)
      continue
    }

    console.log(`[PROPS] Inserting ${rows.length} prop rows for ${sportKey}`)
    const chunkSize = 500
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      // @ts-expect-error - TypeScript struggles with insert type inference in Node module resolution
      const { error } = await supabase.from('player_prop_snapshots').insert(chunk)
      if (error) {
        console.error(`[PROPS] Failed to insert prop chunk for ${sportKey}:`, error.message)
        throw error
      }
    }
  }

  console.log('[PROPS] Completed player prop ingestion')
}

capturePlayerProps().catch((error) => {
  console.error('[PROPS] Player prop ingestion failed:', error)
  process.exit(1)
})
