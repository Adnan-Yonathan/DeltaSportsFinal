import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'
import { normalizePropMarketKey, normalizePropSelection, extractPropLine } from '@/lib/utils/props'

type BetRow = any

function americanToImpliedProb(american: number): number {
  if (!Number.isFinite(american) || american === 0) return 0
  return american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100)
}

function parseSpreadLabel(value: string): { team: string; line: number } | null {
  const m = value.match(/(.+?)\s*([+-]?\d+\.?\d*)/)
  if (!m) return null
  return { team: m[1].trim(), line: parseFloat(m[2]) }
}

function parseTotalLabel(value: string): { dir: 'over' | 'under'; line: number } | null {
  const m = value.match(/(over|under)\s*(\d+\.?\d*)/i)
  if (!m) return null
  return { dir: m[1].toLowerCase() as 'over' | 'under', line: parseFloat(m[2]) }
}

function normalize(s?: string | null) {
  return (s || '').toLowerCase()
}

export async function computeClvForBets(bets: BetRow[]): Promise<{ clvAgg: any; updates: { id: string; patch: any }[] }> {
  const supabase = createClient()

  const bySport = new Map<string, BetRow[]>()
  for (const bet of bets || []) {
    const key = bet.sport_key || bet.sport
    if (!key || !bet.odds_api_id) continue
    if (!bySport.has(key)) bySport.set(key, [])
    bySport.get(key)!.push(bet)
  }

  const updates: { id: string; patch: any }[] = []

  const agg = {
    totalConsidered: 0,
    beat: 0,
    tie: 0,
    noBeat: 0,
    market: {
      moneyline: { total: 0, beat: 0, avgProbDelta: 0 },
      spread: { total: 0, beat: 0, avgPts: 0 },
      total: { total: 0, beat: 0, avgPts: 0 },
      prop: { total: 0, beat: 0, avgPts: 0 },
    },
  }

  for (const [sportKey, group] of bySport.entries()) {
    const games = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], { live: true })
    const byId = new Map<string, any>()
    for (const g of games) byId.set(String(g.id), g)

    for (const bet of group) {
      const game = byId.get(String(bet.odds_api_id))
      if (!game) continue

      const betType = normalize(bet.bet_type)
      const betSide = String(bet.bet_side || '')
      const placedOdds = Number(bet.bet_odds ?? bet.odds ?? 0)
      let closingLine: number | null = null
      let closingOdds: number | null = null
      let clvValue: number | null = null
      let clvMethod: 'points' | 'implied_prob' | null = null
      let beat = false

      if (betType === 'moneyline') {
        const market = game.bookmakers.map((b: any) => ({
          name: b.title,
          market: b.markets.find((m: any) => m.key === 'h2h'),
        })).filter((x: any) => x.market)

        const label = betSide.replace(/\bml\b/i, '').trim().toLowerCase()
        let sel: string | undefined
        const home = (game.home_team || '').toLowerCase()
        const away = (game.away_team || '').toLowerCase()
        if (label && home.includes(label)) sel = game.home_team
        if (!sel && label && away.includes(label)) sel = game.away_team
        let best = { odds: -Infinity as number, name: sel as string | undefined }
        for (const m of market) {
          for (const o of m.market.outcomes || []) {
            if (sel && normalize(o.name) !== normalize(sel)) continue
            if (Number(o.price) > best.odds) best = { odds: Number(o.price), name: o.name }
          }
        }
        if (best.odds !== -Infinity) {
          closingOdds = best.odds
          clvMethod = 'implied_prob'
          const closeProb = americanToImpliedProb(closingOdds)
          const betProb = americanToImpliedProb(placedOdds)
          clvValue = closeProb - betProb
          beat = (clvValue || 0) > 0
        }
      } else if (betType === 'spread') {
        const parsed = parseSpreadLabel(betSide)
        if (parsed) {
          const team = parsed.team.toLowerCase()
          const wantHome = (game.home_team || '').toLowerCase().includes(team)
          const wantAway = (game.away_team || '').toLowerCase().includes(team)
          const market = game.bookmakers.map((b: any) => ({
            name: b.title,
            market: b.markets.find((m: any) => m.key === 'spreads'),
          })).filter((x: any) => x.market)
          let best: { point: number; price: number } | null = null
          for (const m of market) {
            for (const o of m.market.outcomes || []) {
              const isHome = normalize(o.name) === normalize(game.home_team)
              if ((wantHome && isHome) || (wantAway && !isHome)) {
                if (best === null || Number(o.price) > best.price) {
                  best = { point: Number(o.point ?? 0), price: Number(o.price) }
                }
              }
            }
          }
          if (best) {
            closingLine = best.point
            clvMethod = 'points'
            const betLine = Number(bet.bet_line ?? parsed.line)
            const direction = betLine >= 0 ? 1 : -1
            const delta = (closingLine - betLine) * direction
            clvValue = delta
            beat = delta > 0
          }
        }
      } else if (betType === 'total') {
        const parsed = parseTotalLabel(betSide)
        if (parsed) {
          const dir = parsed.dir
          const market = game.bookmakers.map((b: any) => ({
            name: b.title,
            market: b.markets.find((m: any) => m.key === 'totals'),
          })).filter((x: any) => x.market)
          let best: { point: number; price: number } | null = null
          for (const m of market) {
            for (const o of m.market.outcomes || []) {
              const isOver = normalize(o.name) === 'over'
              if ((dir === 'over' && isOver) || (dir === 'under' && !isOver)) {
                if (best === null || Number(o.price) > best.price) {
                  best = { point: Number(o.point ?? 0), price: Number(o.price) }
                }
              }
            }
          }
          if (best) {
            closingLine = best.point
            clvMethod = 'points'
            const betLine = Number(bet.bet_line ?? parsed.line)
            const direction = dir === 'over' ? 1 : -1
            const delta = (closingLine - betLine) * direction
            clvValue = delta
            beat = delta > 0
          }
        }
      } else if (betType === 'prop' || bet.is_prop) {
        const playerName = bet.player_name
        const marketKey = normalizePropMarketKey(bet.prop_market)
        const selection = normalizePropSelection(bet.prop_selection || bet.bet_side)
        const betLine = bet.prop_line ?? extractPropLine(bet.bet_side)

        if (playerName && marketKey && selection && betLine != null) {
          const snapshot = await fetchLatestPropSnapshot(supabase, {
            playerName,
            marketKey,
            eventId: bet.odds_api_id,
            book: bet.book,
          })
          if (snapshot) {
            closingLine = snapshot.line ?? null
            closingOdds = selection === 'over' ? snapshot.over_odds ?? null : snapshot.under_odds ?? null
            if (closingLine != null) {
              clvMethod = 'points'
              const dir = selection === 'over' ? 1 : -1
              const delta = (closingLine - Number(betLine)) * dir
              clvValue = delta
              beat = delta > 0
            }
          }
        }
      }

      if (clvMethod) {
        updates.push({ id: bet.id, patch: {
          bet_odds: Number.isFinite(placedOdds) ? placedOdds : null,
          closing_line: closingLine,
          closing_odds: closingOdds,
          closing_captured_at: new Date().toISOString(),
          clv_value: clvValue,
          clv_method: clvMethod,
          clv_source: 'fallback',
        } })

        agg.totalConsidered++
        if (beat) agg.beat++
        else if ((clvValue || 0) === 0) agg.tie++
        else agg.noBeat++

        if (betType === 'moneyline') {
          agg.market.moneyline.total++
          if (beat) agg.market.moneyline.beat++
          agg.market.moneyline.avgProbDelta += (clvValue || 0)
        }
        if (betType === 'spread') {
          agg.market.spread.total++
          if (beat) agg.market.spread.beat++
          agg.market.spread.avgPts += Math.abs(clvValue || 0)
        }
        if (betType === 'total') {
          agg.market.total.total++
          if (beat) agg.market.total.beat++
          agg.market.total.avgPts += Math.abs(clvValue || 0)
        }
        if (betType === 'prop' || bet.is_prop) {
          agg.market.prop.total++
          if (beat) agg.market.prop.beat++
          agg.market.prop.avgPts += Math.abs(clvValue || 0)
        }
      }
    }
  }

  for (const u of updates) {
    await supabase.from('bets').update(u.patch).eq('id', u.id)
  }

  if (agg.market.moneyline.total > 0) agg.market.moneyline.avgProbDelta /= agg.market.moneyline.total
  if (agg.market.spread.total > 0) agg.market.spread.avgPts /= agg.market.spread.total
  if (agg.market.total.total > 0) agg.market.total.avgPts /= agg.market.total.total
  if (agg.market.prop.total > 0) agg.market.prop.avgPts /= agg.market.prop.total

  return { clvAgg: agg, updates }
}

async function fetchLatestPropSnapshot(
  supabase: any,
  params: { playerName: string; marketKey: string; eventId?: string | null; book?: string | null }
) {
  const { playerName, marketKey, eventId, book } = params
  const baseQuery = () =>
    supabase
      .from('player_prop_snapshots')
      .select('line,over_odds,under_odds,captured_at,book')
      .eq('player_name', playerName)
      .eq('market_key', marketKey)
      .order('captured_at', { ascending: false })
      .limit(1)

  let query = baseQuery()
  if (eventId) query = query.eq('event_id', eventId)
  if (book) query = query.eq('book', book)

  let { data, error } = await query
  if (error) {
    console.error('[CLV] Failed to load prop snapshot:', error.message)
    return null
  }
  if (data && data.length > 0) return data[0]

  if (book) {
    let retry = baseQuery()
    if (eventId) retry = retry.eq('event_id', eventId)
    const retryResult = await retry
    if (retryResult.error) {
      console.error('[CLV] Prop snapshot retry failed:', retryResult.error.message)
      return null
    }
    return retryResult.data?.[0] ?? null
  }

  return null
}
