import { NextRequest, NextResponse } from 'next/server'
import { getPlayerSeasonStats, getTeamStats, formatStatsForAI } from '@/lib/sports-stats-api'
import { createClient } from '@/lib/supabase/server'
import { formatISO } from 'date-fns'

export const runtime = 'nodejs'

const toTitle = (value: string) =>
  value
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')

const buildPlayerCandidates = (message: string): string[] => {
  const words = message
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const candidates = new Set<string>()
  // n-grams of length 2 and 3
  for (let i = 0; i < words.length; i++) {
    for (let len = 2; len <= 3; len++) {
      const slice = words.slice(i, i + len)
      if (slice.length === len) {
        candidates.add(toTitle(slice.join(' ')))
      }
    }
  }
  return Array.from(candidates)
}

const extractTeamName = (message: string): string | null => {
  const match = message.match(/team\s+stats\s+(?:for\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
  if (match?.[1]) return match[1]
  return null
}

type ThresholdQuery = {
  player: string
  stat: 'fg3m'
  comparator: '>=' | '>' | '='
  value: number
  season?: number
}

const detectNBAThreeThreshold = (message: string): ThresholdQuery | null => {
  const lower = message.toLowerCase()
  const threePatterns = /(three|3s|3 pointers|threes|fg3m)/
  const valueMatch = message.match(/(\d+)\s*(?:\+|\b|\s*)(?:threes|3s|three pointers|fg3m|three\-pointers)/i)
  if (!threePatterns.test(lower) || !valueMatch) return null
  const val = Number(valueMatch[1])
  if (!Number.isFinite(val)) return null

  // comparator: look for + or more/over
  const comp = /\b(at\s+least|over|or\s+more|\+)\b/i.test(lower) ? '>=' : '='

  // season: detect "this season" default current
  const now = new Date()
  const currentSeason = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const season = currentSeason

  // player candidate: pick first title-cased n-gram
  const candidates = buildPlayerCandidates(message)
  const player = candidates[0]
  if (!player) return null

  return {
    player,
    stat: 'fg3m',
    comparator: comp as ThresholdQuery['comparator'],
    value: val,
    season,
  }
}

type BalldontliePlayer = { id: number; first_name: string; last_name: string; team?: { full_name?: string } }

const searchBalldontliePlayer = async (name: string): Promise<BalldontliePlayer | null> => {
  const res = await fetch(`https://www.balldontlie.io/api/v1/players?search=${encodeURIComponent(name)}&per_page=5`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) return null
  const data = await res.json()
  const players: any[] = data?.data || []
  if (!players.length) return null
  // pick closest name
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '')
  const target = norm(name)
  const exact = players.find((p) => norm(`${p.first_name} ${p.last_name}`) === target)
  return exact || players[0]
}

const fetchBalldontlieStats = async (playerId: number, season: number) => {
  let page = 1
  const stats: any[] = []
  while (true) {
    const url = `https://www.balldontlie.io/api/v1/stats?player_ids[]=${playerId}&seasons[]=${season}&per_page=100&page=${page}`
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
    if (!res.ok) break
    const data = await res.json()
    stats.push(...(data?.data || []))
    const meta = data?.meta
    if (!meta || page >= meta.total_pages) break
    page += 1
  }
  return stats
}

const buildNBAThreeResult = (games: any[], query: ThresholdQuery) => {
  const filtered = games.filter((g) => {
    const made = Number(g.fg3m ?? g.fg3_m ?? 0)
    if (query.comparator === '>=') return made >= query.value
    if (query.comparator === '>') return made > query.value
    return made === query.value
  })
  const sample = filtered.slice(0, 10).map((g) => {
    const date = g.game?.date ? formatISO(new Date(g.game.date), { representation: 'date' }) : ''
    const opp = g.game?.home_team_id === g.team?.id ? g.game?.visitor_team?.full_name : g.game?.home_team?.full_name
    const made = g.fg3m ?? g.fg3_m
    return `- ${date} vs ${opp || 'opponent'}: ${made} threes`
  })
  return { count: filtered.length, sample }
}

type TripleDoubleQuery = {
  player: string
  scope: 'season' | 'career'
}

const detectTripleDoubleQuery = (message: string): TripleDoubleQuery | null => {
  const lower = message.toLowerCase()
  if (!lower.includes('triple') || !lower.includes('double')) return null
  const candidates = buildPlayerCandidates(message)
  if (!candidates.length) return null
  const scope: TripleDoubleQuery['scope'] = /career|ever|all\s*time/.test(lower) ? 'career' : 'season'
  return { player: candidates[0], scope }
}

const fetchBalldontlieStatsMulti = async (playerId: number, seasons: number[]) => {
  const all: any[] = []
  for (const season of seasons) {
    const stats = await fetchBalldontlieStats(playerId, season)
    all.push(...stats)
  }
  return all
}

const buildTripleDoubleResult = (games: any[]) => {
  const tdGames = games.filter((g) => {
    const pts = Number(g.pts ?? g.pts ?? 0)
    const reb = Number(g.reb ?? g.rebounds ?? 0)
    const ast = Number(g.ast ?? g.assists ?? 0)
    return pts >= 10 && reb >= 10 && ast >= 10
  })
  const sample = tdGames.slice(0, 10).map((g) => {
    const date = g.game?.date ? formatISO(new Date(g.game.date), { representation: 'date' }) : ''
    const opp = g.game?.home_team_id === g.team?.id ? g.game?.visitor_team?.full_name : g.game?.home_team?.full_name
    return `- ${date} vs ${opp || 'opponent'}: ${g.pts} pts, ${g.reb} reb, ${g.ast} ast`
  })
  return { count: tdGames.length, sample }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message: string = body?.message || ''
    const sportHint: string | undefined = body?.sport || body?.sportKey
    const conversationId: string | undefined = body?.conversationId
    const userId: string | undefined = body?.userId

    if (!message || typeof message !== 'string' || !conversationId || !userId) {
      return NextResponse.json({ error: 'message, conversationId, and userId are required' }, { status: 400 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })

    const lower = message.toLowerCase()
    const thresholdNBA = detectNBAThreeThreshold(message)
    const tripleDoubleQuery = detectTripleDoubleQuery(message)
    const playerCandidates = buildPlayerCandidates(message)
    const teamName = extractTeamName(message) || (!playerCandidates.length ? message : null)

    // NBA 3PM threshold queries via balldontlie (statmuse-style)
    if (thresholdNBA) {
      try {
        const player = await searchBalldontliePlayer(thresholdNBA.player)
        if (player) {
          const stats = await fetchBalldontlieStats(player.id, thresholdNBA.season || new Date().getFullYear())
          const result = buildNBAThreeResult(stats, thresholdNBA)
          const replyLines = [
            `${player.first_name} ${player.last_name} â€” games with ${thresholdNBA.value}${thresholdNBA.comparator === '>=' ? '+' : ''} threes (season ${thresholdNBA.season}): ${result.count}`,
          ]
          if (result.sample.length) {
            replyLines.push('Examples:')
            replyLines.push(...result.sample)
          }
          const reply = replyLines.join('\n')
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: reply,
          })
          return NextResponse.json({
            mode: 'statmuse',
            type: 'player_threshold',
            sport: 'basketball_nba',
            reply,
          })
        }
      } catch (err) {
        console.warn('[STATMUSE][NBA] threshold query failed', err)
      }
    }

    // Try player season stats first
    if (tripleDoubleQuery) {
      try {
        const player = await searchBalldontliePlayer(tripleDoubleQuery.player)
        if (player) {
          const now = new Date()
          const currentSeason = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
          const seasons =
            tripleDoubleQuery.scope === 'career'
              ? Array.from({ length: 10 }, (_, idx) => currentSeason - idx) // last 10 seasons
              : [currentSeason]

          const stats = await fetchBalldontlieStatsMulti(player.id, seasons)
          const result = buildTripleDoubleResult(stats)
          const replyLines = [
            `${player.first_name} ${player.last_name} â€” triple-double games (${tripleDoubleQuery.scope === 'career' ? 'last 10 seasons' : `season ${currentSeason}`}): ${result.count}`,
          ]
          if (result.sample.length) {
            replyLines.push('Examples:')
            replyLines.push(...result.sample)
          }
          const reply = replyLines.join('\n')
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: reply,
          })
          return NextResponse.json({
            mode: 'statmuse',
            type: 'player_threshold',
            sport: 'basketball_nba',
            reply,
          })
        }
      } catch (err) {
        console.warn('[STATMUSE][NBA] triple-double query failed', err)
      }
      // If we detected a triple-double intent but couldn't resolve data, skip season-stats fallback
      const fallbackReply = `I couldn't find triple-double game counts for ${tripleDoubleQuery.player}. Try a simpler phrasing like "career triple-doubles for ${tripleDoubleQuery.player}" or another player.`
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: fallbackReply,
      })
      return NextResponse.json({
        mode: 'statmuse',
        type: 'player_threshold',
        sport: 'basketball_nba',
        reply: fallbackReply,
      })
    }

    for (const candidate of playerCandidates) {
      try {
        const stats = await getPlayerSeasonStats(candidate, sportHint)
        if (stats) {
          const reply = formatStatsForAI([stats])
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: reply,
          })
          return NextResponse.json({
            mode: 'statmuse',
            type: 'player',
            reply,
          })
        }
      } catch {
        // continue
      }
    }

    // Try team stats
    if (teamName) {
      // Try NBA then NFL by default
      const sportsToTry = sportHint
        ? [sportHint]
        : ['basketball_nba', 'americanfootball_nfl', 'basketball_ncaab', 'americanfootball_ncaaf']
      for (const sport of sportsToTry) {
        const stats = await getTeamStats(sport, teamName)
        if (stats && stats.length) {
          const reply = formatStatsForAI(stats)
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: reply,
          })
          return NextResponse.json({
            mode: 'statmuse',
            type: 'team',
            sport,
            reply,
          })
        }
      }
    }

    const fallbackReply =
      "I couldn't find stats for that request. Try a player name (e.g., 'LeBron James stats') or a team name (e.g., 'Lakers team stats')."
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: fallbackReply,
    })

    return NextResponse.json({
      mode: 'statmuse',
      reply: fallbackReply,
    })
  } catch (error: any) {
    console.error('[STATMUSE] error', error)
    return NextResponse.json({ error: 'Failed to process statmuse query' }, { status: 500 })
  }
}
