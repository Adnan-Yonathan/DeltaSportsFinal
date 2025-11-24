type SportKey =
  | 'americanfootball_nfl'
  | 'americanfootball_ncaaf'
  | 'basketball_nba'
  | 'basketball_ncaab'
  | 'baseball_mlb'
  | 'icehockey_nhl'
  | string

export interface DraftKingsEventSummary {
  id: number
  name?: string
  startDate?: string
  home?: string
  away?: string
}

export interface DraftKingsSplitOutcome {
  label: string
  line?: number
  moneyline?: number
  ticketsPct?: number
  handlePct?: number
}

export interface DraftKingsSplitMarket {
  market: 'moneyline' | 'spread' | 'total' | 'other'
  eventId?: number
  outcomes: DraftKingsSplitOutcome[]
  lineLabel?: string
  event?: DraftKingsEventSummary
}

export interface SplitInference {
  publicSide?: string
  sharpSide?: string
  confidence: 'none' | 'low' | 'moderate' | 'strong'
  note: string
}

const DEFAULT_EVENT_GROUPS: Record<SportKey, number | undefined> = {
  americanfootball_nfl: 88808,
  americanfootball_ncaaf: 88959,
  basketball_nba: 42648,
  basketball_ncaab: 87601,
  baseball_mlb: 84240,
  icehockey_nhl: 42133,
}

const normalizeToken = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const numberOrUndefined = (value: any): number | undefined => {
  if (value == null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const resolveEventGroupId = (sport: SportKey): number | undefined => {
  const envKey = `DK_EVENTGROUP_${sport.toUpperCase()}`.replace(/[^A-Z0-9_]/g, '_')
  const envVal = process.env[envKey]
  if (envVal && !Number.isNaN(Number(envVal))) return Number(envVal)
  return DEFAULT_EVENT_GROUPS[sport]
}

const pickLabel = (outcome: any): string => {
  return (
    outcome?.label ||
    outcome?.outcomeDescription ||
    outcome?.name ||
    outcome?.outcomeName ||
    outcome?.team ||
    'Side'
  )
}

const extractPercent = (outcome: any, keys: string[]): number | undefined => {
  for (const key of keys) {
    const v = numberOrUndefined(outcome?.[key])
    if (v != null) return v
  }
  return undefined
}

const mapEventSummary = (ev: any): DraftKingsEventSummary => {
  return {
    id: Number(ev?.eventId ?? ev?.id ?? 0),
    name: ev?.name,
    startDate: ev?.startDate || ev?.eventStartDate || ev?.startTime,
    home: ev?.teamName2 || ev?.homeTeam || ev?.homeTeamName || ev?.homeTeamAbbreviation,
    away: ev?.teamName1 || ev?.awayTeam || ev?.awayTeamName || ev?.awayTeamAbbreviation,
  }
}

const normalizeMarketType = (offer: any, outcomes: any[]): DraftKingsSplitMarket['market'] => {
  const label = `${offer?.label || offer?.name || ''}`.toLowerCase()
  const subName = `${offer?.offerSubcategoryName || ''}`.toLowerCase()
  const combined = `${label} ${subName}`.trim()
  if (combined.includes('spread')) return 'spread'
  if (combined.includes('point') && combined.includes('line')) return 'spread'
  if (combined.includes('moneyline') || combined.includes('ml') || combined.includes('h2h')) return 'moneyline'
  if (combined.includes('total') || combined.includes('over/under') || combined.includes('ou')) return 'total'
  if (outcomes.some((o) => (o?.label || '').toLowerCase() === 'over' || (o?.label || '').toLowerCase() === 'under')) {
    return 'total'
  }
  return 'other'
}

const flattenOffers = (body: any): any[] => {
  const offers: any[] = []
  const categories = body?.eventGroup?.offerCategories || body?.offerCategories || []
  for (const cat of categories) {
    const subDescs = cat?.offerSubcategoryDescriptors || cat?.offerSubcategory || []
    for (const sub of subDescs) {
      const subOffers = sub?.offerSubcategory?.offers || sub?.offers || sub?.betOffers || []
      for (const group of subOffers) {
        if (Array.isArray(group)) {
          for (const offer of group) offers.push(offer)
        } else if (group) {
          offers.push(group)
        }
      }
    }
  }
  return offers
}

export const extractMarketsFromDraftKings = (
  body: any
): { markets: DraftKingsSplitMarket[]; events: DraftKingsEventSummary[] } => {
  const eventsRaw = Array.isArray(body?.eventGroup?.events) ? body.eventGroup.events : body?.events || []
  const events = eventsRaw.map(mapEventSummary).filter((e: DraftKingsEventSummary) => e.id)
  const eventIndex: Map<number, DraftKingsEventSummary> = new Map(
    events.map((e: DraftKingsEventSummary) => [e.id, e])
  )
  const markets: DraftKingsSplitMarket[] = []

  for (const offer of flattenOffers(body)) {
    const outcomesRaw: any[] = offer?.outcomes || offer?.outcomeList || []
    if (!Array.isArray(outcomesRaw) || outcomesRaw.length === 0) continue

    const eventId = numberOrUndefined(offer?.eventId || (Array.isArray(offer?.eventIds) ? offer.eventIds[0] : undefined))
    const normalizedOutcomes: DraftKingsSplitOutcome[] = []
    for (const outcome of outcomesRaw) {
      const ticketsPct = extractPercent(outcome, [
        'ticketsPercentage',
        'ticketPercentage',
        'ticketPercent',
        'betCountPercentage',
        'betPercentage',
        'percentageOfBets',
        'percentageOfTickets',
      ])
      const handlePct = extractPercent(outcome, [
        'handlePercentage',
        'handlePercent',
        'moneyPercentage',
        'percentageOfHandle',
        'moneyPercent',
        'percentOfMoney',
      ])

      if (ticketsPct == null && handlePct == null) continue

      normalizedOutcomes.push({
        label: pickLabel(outcome),
        line: numberOrUndefined(outcome?.line ?? outcome?.point ?? outcome?.handicap),
        moneyline: numberOrUndefined(outcome?.moneyline ?? outcome?.oddsAmerican ?? outcome?.price),
        ticketsPct,
        handlePct,
      })
    }

    if (normalizedOutcomes.length === 0) continue

    const market: DraftKingsSplitMarket = {
      market: normalizeMarketType(offer, outcomesRaw),
      eventId,
      outcomes: normalizedOutcomes,
      lineLabel: offer?.label,
      event: eventId ? eventIndex.get(eventId) : undefined,
    }

    markets.push(market)
  }

  return { markets, events }
}

export async function fetchDraftKingsSplits(sport: SportKey): Promise<{
  markets: DraftKingsSplitMarket[]
  events: DraftKingsEventSummary[]
  error?: string
}> {
  const eventGroupId = resolveEventGroupId(sport)
  if (!eventGroupId) {
    return { markets: [], events: [], error: `No DraftKings event group configured for ${sport}` }
  }

  const url = `https://sportsbook.draftkings.com/sites/US-SB/api/v5/eventgroups/${eventGroupId}?format=json`
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (DeltaSportsBot)',
        Accept: 'application/json',
        Referer: 'https://sportsbook.draftkings.com/',
      },
    })

    if (!res.ok) {
      return { markets: [], events: [], error: `DraftKings returned ${res.status}` }
    }

    const body = await res.json()
    const { markets, events } = extractMarketsFromDraftKings(body)
    if (!markets.length) {
      return {
        markets: [],
        events,
        error: 'No betting split markets found in DraftKings payload',
      }
    }
    return { markets, events }
  } catch (err: any) {
    const message = err?.message || 'Failed to fetch DraftKings splits'
    return { markets: [], events: [], error: message }
  }
}

export const inferSharpPublic = (market: DraftKingsSplitMarket): SplitInference => {
  if (!market.outcomes || market.outcomes.length < 2) {
    return { confidence: 'none', note: 'Not enough outcomes to infer' }
  }

  const withPercents = market.outcomes.filter(
    (o) => typeof o.ticketsPct === 'number' && typeof o.handlePct === 'number'
  )
  if (withPercents.length < 2) {
    return { confidence: 'none', note: 'Missing ticket/handle percentages' }
  }

  const sortedHandle = [...withPercents].sort((a, b) => (b.handlePct ?? 0) - (a.handlePct ?? 0))
  const sortedTickets = [...withPercents].sort((a, b) => (b.ticketsPct ?? 0) - (a.ticketsPct ?? 0))
  const topHandle = sortedHandle[0]
  const topTickets = sortedTickets[0]

  const gapHandle = (topHandle.handlePct ?? 0) - (topHandle.ticketsPct ?? 0)
  const gapTickets = (topTickets.ticketsPct ?? 0) - (topTickets.handlePct ?? 0)
  const absGap = Math.max(Math.abs(gapHandle), Math.abs(gapTickets))

  const confidence =
    absGap >= 30 ? 'strong' : absGap >= 20 ? 'moderate' : absGap >= 10 ? 'low' : 'none'

  // Consensus: both handle and tickets lean same way without big gap
  if (confidence === 'none') {
    return { confidence: 'none', note: 'Handle and tickets are aligned—no clear sharp/public split' }
  }

  const sharpSide = gapHandle > 0 ? topHandle.label : undefined
  const publicSide = gapTickets > 0 ? topTickets.label : undefined

  if (!sharpSide && publicSide) {
    return { confidence, note: 'Public and handle align on the same side' }
  }

  const note = gapHandle > 0
    ? `Handle favors ${topHandle.label} by ${gapHandle.toFixed(1)} pts over tickets`
    : `Tickets lead ${topTickets.label} by ${gapTickets.toFixed(1)} pts over handle`

  return { sharpSide, publicSide, confidence, note }
}

export const formatMarketSummary = (
  market: DraftKingsSplitMarket,
  inference: SplitInference
): string => {
  const label = market.market === 'moneyline'
    ? 'Moneyline'
    : market.market === 'spread'
      ? 'Spread'
      : market.market === 'total'
        ? 'Total'
        : market.lineLabel || 'Market'

  const fmtPct = (v?: number) => (v == null || !Number.isFinite(v) ? '?' : `${v.toFixed(0)}%`)
  const parts: string[] = []

  for (const outcome of market.outcomes) {
    const line =
      market.market === 'spread' && outcome.line != null
        ? `${outcome.label} ${outcome.line > 0 ? '+' : ''}${outcome.line}`
        : market.market === 'total' && outcome.line != null
          ? `${outcome.label} ${outcome.line}`
          : outcome.label
    parts.push(`${line}: ${fmtPct(outcome.ticketsPct)} tickets / ${fmtPct(outcome.handlePct)} handle`)
  }

  let inferenceText = ''
  if (inference.confidence !== 'none') {
    const strength = inference.confidence === 'strong' ? 'strong' : inference.confidence === 'moderate' ? 'moderate' : 'low'
    const publicSide = inference.publicSide ? `public → ${inference.publicSide}` : 'public unclear'
    const sharpSide = inference.sharpSide ? `sharp → ${inference.sharpSide}` : 'sharp unclear'
    inferenceText = ` (${publicSide}; ${sharpSide}; ${strength})`
  } else {
    inferenceText = ' (no clear sharp/public split)'
  }

  return `${label}: ${parts.join(' | ')}${inferenceText}`
}

export const summarizeSplitsForChat = async (opts: {
  message: string
  teams?: string[]
  sports?: SportKey[]
  timezone?: string
  percentOnly?: boolean
}): Promise<string> => {
  const { message, teams = [], sports, timezone = 'America/New_York', percentOnly = false } = opts
  const msgLower = message.toLowerCase()

  const guessedSports: SportKey[] =
    sports && sports.length
      ? sports
      : [
          msgLower.match(/nba|basketball/) ? 'basketball_nba' : undefined,
          msgLower.match(/nfl|football/) ? 'americanfootball_nfl' : undefined,
          msgLower.match(/ncaab|college basketball|cbb|march madness/) ? 'basketball_ncaab' : undefined,
          msgLower.match(/ncaaf|college football|cfb/) ? 'americanfootball_ncaaf' : undefined,
          msgLower.match(/mlb|baseball/) ? 'baseball_mlb' : undefined,
          msgLower.match(/nhl|hockey/) ? 'icehockey_nhl' : undefined,
        ].filter(Boolean) as SportKey[]

  if (!guessedSports.length) {
    guessedSports.push('americanfootball_nfl', 'basketball_nba')
  }

  const normalizedTeams = teams.map(normalizeToken).filter(Boolean)

  for (const sport of guessedSports) {
    const result = await fetchDraftKingsSplits(sport)
    if (!result.markets.length) {
      if (result.error) {
        return `DraftKings splits unavailable for ${sport.replace('_', ' ')}: ${result.error}`
      }
      continue
    }

    // Choose event by team match, else earliest by start time
    const matchScore = (event?: DraftKingsEventSummary): number => {
      if (!event) return 0
      const tokens = [event.home, event.away, event.name]
        .filter(Boolean)
        .map(normalizeToken)
      let score = 0
      for (const team of normalizedTeams) {
        if (!team) continue
        if (tokens.some((t) => t.includes(team) || team.includes(t))) {
          score += 1
        }
      }
      return score
    }

    const marketsByEvent = result.markets.reduce<Map<number, DraftKingsSplitMarket[]>>((map, m) => {
      if (!m.eventId) return map
      if (!map.has(m.eventId)) map.set(m.eventId, [])
      map.get(m.eventId)!.push(m)
      return map
    }, new Map())

    let targetEventId: number | undefined
    let bestScore = -1

    for (const ev of result.events) {
      const score = matchScore(ev)
      if (score > bestScore) {
        bestScore = score
        targetEventId = ev.id
      }
    }

    if (targetEventId == null) {
      // pick earliest by date
      const sorted = [...result.events].sort((a, b) =>
        new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime()
      )
      targetEventId = sorted[0]?.id
    }

    const selectedMarkets = targetEventId ? marketsByEvent.get(targetEventId) || [] : result.markets
    if (!selectedMarkets.length) {
      continue
    }

    const orderedMarkets = ['spread', 'moneyline', 'total', 'other'] as const
    selectedMarkets.sort(
      (a, b) => orderedMarkets.indexOf(a.market as any) - orderedMarkets.indexOf(b.market as any)
    )

    const lines: string[] = []
    const event = result.events.find((ev) => ev.id === targetEventId)
    if (event) {
      const when = event.startDate
        ? new Date(event.startDate).toLocaleString('en-US', {
            timeZone: timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : ''
      lines.push(`**${event.away || 'Away'} @ ${event.home || 'Home'}**${when ? ` — ${when}` : ''}`)
    }

    for (const market of selectedMarkets) {
      const inference = inferSharpPublic(market)
      if (percentOnly) {
        const fmtPct = (v?: number) => (v == null || !Number.isFinite(v) ? '?' : `${v.toFixed(0)}%`)
        const parts = market.outcomes.map(
          (o) => `${o.label}: ${fmtPct(o.ticketsPct)} bets / ${fmtPct(o.handlePct)} money`
        )
        lines.push(parts.join(' | '))
      } else {
        lines.push(formatMarketSummary(market, inference))
      }
    }

    return lines.join('\n')
  }

  return 'No DraftKings betting splits available right now.'
}
