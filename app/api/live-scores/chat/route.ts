import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores, fetchGameDetails, type LeagueId } from '@/lib/live-scores'
import { getPlayerSeasonStats } from '@/lib/sports-stats-api'

export const runtime = 'nodejs'

type MessageIntent = 'today' | 'tomorrow' | 'scores'

const normalizeDate = (hint?: 'today' | 'tomorrow', provided?: string) => {
  if (provided) return provided
  const now = new Date()
  if (hint === 'tomorrow') {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  }
  return now.toISOString().slice(0, 10)
}

const detectIntent = (message: string): { intent: MessageIntent; dateHint?: 'tomorrow' } => {
  const lower = message.toLowerCase()
  if (/\btomorrow\b/.test(lower)) return { intent: 'scores', dateHint: 'tomorrow' }
  if (/\btoday\b/.test(lower)) return { intent: 'today' }
  return { intent: 'scores' }
}

const extractPlayerName = (message: string): string | null => {
  const statMatch = message.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:season\s+)?stats?/i)
  if (statMatch?.[1]) return statMatch[1].trim()
  const generic = message.match(/player\s+stats?\s+for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
  if (generic?.[1]) return generic[1].trim()
  return null
}

const extractMatchupTeams = (message: string): string[] => {
  const vsMatch = message.match(/([a-zA-Z][a-zA-Z\s.&'-]+?)\s+(?:vs\.?|v\.?|@)\s+([a-zA-Z][a-zA-Z\s.&'-]+)/i)
  if (vsMatch) {
    return [vsMatch[1].trim(), vsMatch[2].trim()]
  }
  return []
}

const formatStatus = (bucket: string, status?: { detail?: string; shortDetail?: string; displayClock?: string; period?: number }, startTime?: string) => {
  if (bucket === 'completed') return 'Final'
  if (bucket === 'live') {
    const clock = status?.displayClock
    const period = status?.period ? `P${status.period}` : ''
    return [clock, period].filter(Boolean).join(' ') || 'Live'
  }
  if (!startTime) return 'Scheduled'
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(startTime))
  } catch {
    return startTime
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message: string = body?.message || ''
    const leagues: LeagueId[] | undefined = Array.isArray(body?.leagues) ? body.leagues : undefined
    const explicitDate: string | undefined = body?.date

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const intent = detectIntent(message)
    const playerName = extractPlayerName(message)
    const matchupTeams = extractMatchupTeams(message)
    const targetDate = normalizeDate(intent.dateHint, explicitDate)
    const scores = await fetchAllLiveScores({ date: targetDate })

    const filteredGames = scores.games.filter((g) => !leagues || leagues.includes(g.league))
    const buckets = filteredGames.reduce(
      (acc, game) => {
        acc[game.bucket]?.push(game)
        return acc
      },
      { live: [] as typeof filteredGames, upcoming: [] as typeof filteredGames, completed: [] as typeof filteredGames }
    )

    const describeGame = (game: (typeof filteredGames)[number]) => {
      const home = game.competitors.find((c) => c.homeAway === 'home')
      const away = game.competitors.find((c) => c.homeAway === 'away')
      const status = formatStatus(game.bucket, game.status, game.startTime)
      const scoreLine =
        game.bucket === 'live' || game.bucket === 'completed'
          ? ` — ${away?.shortName || away?.name} ${away?.score ?? ''} @ ${home?.shortName || home?.name} ${home?.score ?? ''}`
          : ''
      return `${game.leagueLabel}: ${away?.shortName || away?.name} @ ${home?.shortName || home?.name} (${status})${scoreLine}`
    }

    // Player stats path
    if (playerName) {
      const stats = await getPlayerSeasonStats(playerName)
      if (!stats) {
        return NextResponse.json({
          reply: `I couldn't find season stats for ${playerName} in ESPN data.`,
          date: targetDate,
          leagues: leagues || 'all',
          source: 'espn',
        })
      }
      const lines: string[] = []
      lines.push(`Season stats for ${stats.name} (${stats.team || 'Unknown'})${stats.season ? ` • Season ${stats.season}` : ''}:`)
      Object.entries(stats.stats || {}).forEach(([k, v]) => {
        lines.push(`- ${k.replace(/_/g, ' ')}: ${v}`)
      })
      return NextResponse.json({
        reply: lines.join('\n'),
        date: targetDate,
        leagues: leagues || 'all',
        source: 'espn',
      })
    }

    // Game stats path: try to match a specific game and show details
    if (matchupTeams.length === 2) {
      const normalized = matchupTeams.map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
      const game = filteredGames.find((g) => {
        const home = g.competitors.find((c) => c.homeAway === 'home')
        const away = g.competitors.find((c) => c.homeAway === 'away')
        const homeName = (home?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const awayName = (away?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        return (
          (homeName.includes(normalized[0]) && awayName.includes(normalized[1])) ||
          (homeName.includes(normalized[1]) && awayName.includes(normalized[0]))
        )
      })

      if (game) {
        try {
          const details = await fetchGameDetails(game.league, game.eventId)
          const home = game.competitors.find((c) => c.homeAway === 'home')
          const away = game.competitors.find((c) => c.homeAway === 'away')
          const linescore =
            details.teams
              ?.map((team) => {
                const teamLabel = `${team.name}${Number.isFinite(team.score) ? ` ${team.score}` : ''}`
                const parts = team.linescore?.map((entry) => `${entry.label || ''}:${entry.value || ''}`).join(' ')
                return parts ? `${teamLabel} [${parts}]` : teamLabel
              })
              .join('\n') || null
          const summary = `${away?.shortName || away?.name} @ ${home?.shortName || home?.name} — ${formatStatus(game.bucket, game.status, game.startTime)}`
          const replyLines = [summary]
          if (linescore) replyLines.push(linescore)
          if (details.teams?.length) {
            replyLines.push('Key stats:')
            details.teams.slice(0, 2).forEach((team) => {
              const statLine = (team.statistics || []).slice(0, 5).map((s) => `${s.label}: ${s.value}`).join(' | ')
              replyLines.push(`- ${team.name}: ${statLine || 'n/a'}`)
            })
          }
          return NextResponse.json({
            reply: replyLines.join('\n'),
            date: targetDate,
            leagues: leagues || 'all',
            source: 'espn',
          })
        } catch (err) {
          console.warn('[live-scores-chat] game details fetch failed', err)
        }
      }
    }

    const lines: string[] = []
    lines.push(`Here are the games for ${targetDate}${leagues?.length ? ` (${leagues.join(', ')})` : ''}:`)
    if (buckets.live.length) {
      lines.push(`Live (${buckets.live.length}):`)
      lines.push(...buckets.live.slice(0, 5).map(describeGame))
    }
    if (buckets.upcoming.length) {
      lines.push(`Upcoming (${buckets.upcoming.length}):`)
      lines.push(...buckets.upcoming.slice(0, 5).map(describeGame))
    }
    if (buckets.completed.length) {
      lines.push(`Finals (${buckets.completed.length}):`)
      lines.push(...buckets.completed.slice(0, 5).map(describeGame))
    }
    if (!filteredGames.length) {
      lines.push('No games found for that date/league.')
    }

    return NextResponse.json({
      reply: lines.join('\n'),
      date: targetDate,
      leagues: leagues || 'all',
      source: 'espn',
      counts: {
        live: buckets.live.length,
        upcoming: buckets.upcoming.length,
        completed: buckets.completed.length,
      },
    })
  } catch (error: any) {
    console.error('[live-scores-chat] error', error)
    return NextResponse.json({ error: 'Failed to answer with ESPN live scores' }, { status: 500 })
  }
}
