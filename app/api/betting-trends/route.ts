import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { oddsToImpliedProbability } from '@/lib/utils/statistics'

export const dynamic = 'force-dynamic'

type LineRow = {
  odds_api_id: string
  market_type: 'spread' | 'total' | 'moneyline'
  line_type: 'opening' | 'closing' | 'current'
  bookmaker?: string | null
  game_time?: string | null
  home_team?: string | null
  away_team?: string | null
  spread_home?: number | null
  total_line?: number | null
  moneyline_home?: number | null
  is_sharp_move?: boolean | null
  recorded_at?: string | null
}

type MarketSummary = {
  sampleCount: number
  avgAbsMove: number | null
  avgMove: number | null
  movedUpPct: number | null
  movedDownPct: number | null
  sharpMoveRate: number | null
  avgImpliedProbChange?: number | null
  avgImpliedProbChangeAbs?: number | null
}

const median = (values: number[]) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || 'basketball_nba'
    const days = Math.max(1, Number(searchParams.get('days') || 30))
    const limit = Math.max(500, Number(searchParams.get('limit') || 5000))

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = (await supabase
      .from('lines' as any)
      .select(
        'odds_api_id,market_type,line_type,bookmaker,game_time,home_team,away_team,spread_home,total_line,moneyline_home,is_sharp_move,recorded_at'
      )
      .eq('sport', sport)
      .in('line_type', ['opening', 'closing', 'current'])
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true })
      .limit(limit)) as { data: LineRow[] | null; error: any }

    if (error) {
      console.error('[betting-trends] line query failed', error)
      return NextResponse.json(
        { error: 'Failed to fetch line history.' },
        { status: 500 }
      )
    }

    const rows = data ?? []
    const byGame = new Map<
      string,
      {
        marketType: LineRow['market_type']
        homeTeam?: string | null
        awayTeam?: string | null
        gameTime?: string | null
        opening: number[]
        closing: number[]
        current: Array<{ value: number; recordedAt: string | null }>
        sharpMoves: number
        totalRecords: number
        openingOdds: number[]
        closingOdds: number[]
        currentOdds: Array<{ value: number; recordedAt: string | null }>
      }
    >()

    for (const row of rows) {
      const key = `${row.odds_api_id}:${row.market_type}`
      const entry = byGame.get(key) ?? {
        marketType: row.market_type,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        gameTime: row.game_time,
        opening: [],
        closing: [],
        current: [],
        sharpMoves: 0,
        totalRecords: 0,
        openingOdds: [],
        closingOdds: [],
        currentOdds: [],
      }

      const value =
        row.market_type === 'spread'
          ? row.spread_home
          : row.market_type === 'total'
            ? row.total_line
            : row.moneyline_home

      if (Number.isFinite(value)) {
        if (row.line_type === 'opening') {
          entry.opening.push(Number(value))
        } else if (row.line_type === 'closing') {
          entry.closing.push(Number(value))
        } else {
          entry.current.push({
            value: Number(value),
            recordedAt: row.recorded_at ?? null,
          })
        }
      }

      if (row.market_type === 'moneyline') {
        const oddsValue = row.moneyline_home
        if (Number.isFinite(oddsValue)) {
          if (row.line_type === 'opening') {
            entry.openingOdds.push(Number(oddsValue))
          } else if (row.line_type === 'closing') {
            entry.closingOdds.push(Number(oddsValue))
          } else {
            entry.currentOdds.push({
              value: Number(oddsValue),
              recordedAt: row.recorded_at ?? null,
            })
          }
        }
      }

      if (row.is_sharp_move) {
        entry.sharpMoves += 1
      }
      entry.totalRecords += 1
      if (!byGame.has(key)) byGame.set(key, entry)
    }

    const summaryByMarket = new Map<LineRow['market_type'], MarketSummary>()
    const topMoves: Array<{
      oddsApiId: string
      marketType: LineRow['market_type']
      homeTeam: string | null
      awayTeam: string | null
      gameTime: string | null
      openingLine: number
      closingLine: number
      delta: number
    }> = []

    const pushSummary = (market: LineRow['market_type'], delta: number, sharpRate: number) => {
      const summary = summaryByMarket.get(market) ?? {
        sampleCount: 0,
        avgAbsMove: null,
        avgMove: null,
        movedUpPct: null,
        movedDownPct: null,
        sharpMoveRate: null,
      }

      summary.sampleCount += 1
      const abs = Math.abs(delta)
      summary.avgAbsMove = (summary.avgAbsMove ?? 0) + abs
      summary.avgMove = (summary.avgMove ?? 0) + delta
      if (delta > 0) {
        summary.movedUpPct = (summary.movedUpPct ?? 0) + 1
      } else if (delta < 0) {
        summary.movedDownPct = (summary.movedDownPct ?? 0) + 1
      }
      summary.sharpMoveRate = (summary.sharpMoveRate ?? 0) + sharpRate
      summaryByMarket.set(market, summary)
    }

    const pushMoneylineSummary = (deltaProb: number, absDeltaProb: number) => {
      const summary = summaryByMarket.get('moneyline') ?? {
        sampleCount: 0,
        avgAbsMove: null,
        avgMove: null,
        movedUpPct: null,
        movedDownPct: null,
        sharpMoveRate: null,
        avgImpliedProbChange: null,
        avgImpliedProbChangeAbs: null,
      }
      summary.avgImpliedProbChange = (summary.avgImpliedProbChange ?? 0) + deltaProb
      summary.avgImpliedProbChangeAbs = (summary.avgImpliedProbChangeAbs ?? 0) + absDeltaProb
      summaryByMarket.set('moneyline', summary)
    }

    for (const [key, entry] of byGame.entries()) {
      const openingMedian = median(entry.opening)
      const closingMedian = median(entry.closing)

      const currentSorted = entry.current
        .filter((item) => item.recordedAt)
        .sort(
          (a, b) =>
            Date.parse(a.recordedAt as string) -
            Date.parse(b.recordedAt as string)
        )
      const currentOpening = currentSorted.length ? currentSorted[0].value : null
      const currentClosing = currentSorted.length
        ? currentSorted[currentSorted.length - 1].value
        : null

      const effectiveOpening = openingMedian ?? currentOpening
      const effectiveClosing = closingMedian ?? currentClosing
      if (effectiveOpening == null || effectiveClosing == null) continue

      const delta = effectiveClosing - effectiveOpening
      const sharpRate = entry.totalRecords > 0 ? entry.sharpMoves / entry.totalRecords : 0

      pushSummary(entry.marketType, delta, sharpRate)
      topMoves.push({
        oddsApiId: key.split(':')[0] || '',
        marketType: entry.marketType,
        homeTeam: entry.homeTeam ?? null,
        awayTeam: entry.awayTeam ?? null,
        gameTime: entry.gameTime ?? null,
        openingLine: effectiveOpening,
        closingLine: effectiveClosing,
        delta,
      })

      if (entry.marketType === 'moneyline') {
        const openingOdds = median(entry.openingOdds)
        const closingOdds = median(entry.closingOdds)
        const currentOddsSorted = entry.currentOdds
          .filter((item) => item.recordedAt)
          .sort(
            (a, b) =>
              Date.parse(a.recordedAt as string) -
              Date.parse(b.recordedAt as string)
          )
        const fallbackOpeningOdds = currentOddsSorted.length
          ? currentOddsSorted[0].value
          : null
        const fallbackClosingOdds = currentOddsSorted.length
          ? currentOddsSorted[currentOddsSorted.length - 1].value
          : null
        const effectiveOpeningOdds = openingOdds ?? fallbackOpeningOdds
        const effectiveClosingOdds = closingOdds ?? fallbackClosingOdds
        if (effectiveOpeningOdds != null && effectiveClosingOdds != null) {
          const deltaProb =
            oddsToImpliedProbability(effectiveClosingOdds) -
            oddsToImpliedProbability(effectiveOpeningOdds)
          pushMoneylineSummary(deltaProb, Math.abs(deltaProb))
        }
      }
    }

    const summary: Record<string, MarketSummary> = {}
    for (const [market, values] of summaryByMarket.entries()) {
      const count = values.sampleCount
      summary[market] = {
        ...values,
        avgAbsMove: count ? (values.avgAbsMove ?? 0) / count : null,
        avgMove: count ? (values.avgMove ?? 0) / count : null,
        movedUpPct: count ? ((values.movedUpPct ?? 0) / count) * 100 : null,
        movedDownPct: count ? ((values.movedDownPct ?? 0) / count) * 100 : null,
        sharpMoveRate: count ? ((values.sharpMoveRate ?? 0) / count) * 100 : null,
        avgImpliedProbChange:
          values.avgImpliedProbChange != null && count
            ? values.avgImpliedProbChange / count
            : values.avgImpliedProbChange ?? null,
        avgImpliedProbChangeAbs:
          values.avgImpliedProbChangeAbs != null && count
            ? values.avgImpliedProbChangeAbs / count
            : values.avgImpliedProbChangeAbs ?? null,
      }
    }

    const topMovesSorted = [...topMoves]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 8)

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      sport,
      days,
      summary,
      topMoves: topMovesSorted,
      sampleCount: topMoves.length,
    })
  } catch (error) {
    console.error('[betting-trends] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch betting trends.' },
      { status: 500 }
    )
  }
}
