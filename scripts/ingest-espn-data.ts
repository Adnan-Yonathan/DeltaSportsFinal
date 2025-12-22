/**
 * Lightweight ESPN ingest for Supabase: season-level team/player stats and optional betting context (SBD futures + ESPN ATS/odds records/predictor).
 * Usage: ts-node scripts/ingest-espn-data.ts --sport nfl --seasons 2020,2021,2022,2023,2024
 */
import { createServiceClient } from '@/lib/supabase/service'
import { fetchTeamList as fetchNflTeams, fetchRoster as fetchNflRoster, fetchTeamStatistics as fetchNflTeamStats, fetchAthleteStatistics as fetchNflAthleteStats } from '@/lib/providers/espn-nfl'
import { fetchTeamList as fetchNbaTeams, fetchRoster as fetchNbaRoster, fetchTeamStatistics as fetchNbaTeamStats, fetchAthleteStatistics as fetchNbaAthleteStats } from '@/lib/providers/espn-nba'
import { fetchTeamList as fetchMlbTeams, fetchRoster as fetchMlbRoster, fetchTeamStatistics as fetchMlbTeamStats, fetchAthleteStatistics as fetchMlbAthleteStats } from '@/lib/providers/espn-mlb'
import { fetchTeamList as fetchNhlTeams, fetchRoster as fetchNhlRoster, fetchTeamStatistics as fetchNhlTeamStats, fetchAthleteStatistics as fetchNhlAthleteStats } from '@/lib/providers/espn-nhl'
import {
  fetchTeamAts,
  fetchTeamOddsRecord,
  fetchPredictor,
  fetchPowerIndex,
  fetchTeamPastPerformances,
} from '@/lib/providers/espn-betting'
import { fetchSbdFuturesMarket, fetchSbdFuturesMarkets, resolveBookIds, resolveSbdLeague } from '@/lib/api/sbd'
import { fetchInjuries as fetchNflInjuries } from '@/lib/providers/espn-nfl'
import { fetchInjuries as fetchNbaInjuries } from '@/lib/providers/espn-nba'
import { fetchInjuries as fetchMlbInjuries } from '@/lib/providers/espn-mlb'
import { fetchInjuries as fetchNhlInjuries } from '@/lib/providers/espn-nhl'

const SPORT_SCOREBOARD: Record<SportKey, string> = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
}

type SportKey = 'nfl' | 'nba' | 'mlb' | 'nhl'

interface IngestConfig {
  sport: SportKey
  seasons: number[]
  seasonType?: number
}

const SPORT_PATH: Record<SportKey, string> = {
  nfl: 'football/leagues/nfl',
  nba: 'basketball/leagues/nba',
  mlb: 'baseball/leagues/mlb',
  nhl: 'icehockey/leagues/nhl',
}

const getSupabase = () => createServiceClient() as any

const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const fetchJson = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' as RequestCache })
  if (!res.ok) return null
  return res.json()
}

const fetchSbdFutures = async (sport: SportKey) => {
  const league = resolveSbdLeague(sport)
  if (!league) return []
  const marketsPayload = await fetchSbdFuturesMarkets(league)
  const markets = Array.isArray(marketsPayload?.data) ? marketsPayload.data : []
  const bookIds = resolveBookIds(process.env.SBD_BOOK_IDS || process.env.ODDS_BOOKMAKERS || null)
  const futures: any[] = []

  for (const market of markets) {
    if (!market?.id || !market?.name) continue
    const details = await fetchSbdFuturesMarket(league, market.id, { books: bookIds })
    futures.push({
      market_id: market.id,
      market_name: market.name,
      selections: details?.data || [],
      source: 'sportsbettingdime',
      fetched_at: new Date().toISOString(),
    })
  }

  return futures
}

const parseArgs = (): IngestConfig => {
  const args = process.argv.slice(2)
  const sportArg = args.find((a) => a.startsWith('--sport='))?.split('=')[1] as SportKey | undefined
  const seasonsArg = args.find((a) => a.startsWith('--seasons='))?.split('=')[1]
  if (!sportArg || !seasonsArg) {
    console.error('Usage: ts-node scripts/ingest-espn-data.ts --sport nfl --seasons 2020,2021,2022')
    process.exit(1)
  }
  const seasons = seasonsArg
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
  return { sport: sportArg, seasons, seasonType: 2 }
}

const fetchTeamBlock = async (sport: SportKey) => {
  if (sport === 'nfl') return await fetchNflTeams()
  if (sport === 'nba') return await fetchNbaTeams()
  if (sport === 'mlb') return await fetchMlbTeams()
  return await fetchNhlTeams()
}

const fetchRosterBlock = async (sport: SportKey, teamId: string) => {
  if (sport === 'nfl') return await fetchNflRoster(teamId)
  if (sport === 'nba') return await fetchNbaRoster(teamId)
  if (sport === 'mlb') return await fetchMlbRoster(teamId)
  return await fetchNhlRoster(teamId)
}

const fetchTeamStatsBlock = async (sport: SportKey, teamId: string, season: number) => {
  if (sport === 'nfl') return await fetchNflTeamStats(teamId, season)
  if (sport === 'nba') return await fetchNbaTeamStats(teamId, season)
  if (sport === 'mlb') return await fetchMlbTeamStats(teamId, season)
  return await fetchNhlTeamStats(teamId, season)
}

const fetchPlayerStatsBlock = async (sport: SportKey, athleteId: string, season: number) => {
  if (sport === 'nfl') return await fetchNflAthleteStats(athleteId, season)
  if (sport === 'nba') return await fetchNbaAthleteStats(athleteId, season)
  if (sport === 'mlb') return await fetchMlbAthleteStats(athleteId, season)
  return await fetchNhlAthleteStats(athleteId, season)
}

const upsertTeamSeason = async (supabase: any, payload: any) => {
  const res = await supabase.from('team_season_stats').upsert(payload, { onConflict: 'team_provider_id,sport_key,season,season_type' })
  if (res.error) console.error('[UPSERT][team_season_stats]', res.error)
}

const upsertPlayerSeason = async (supabase: any, payload: any) => {
  const res = await supabase.from('player_season_stats').upsert(payload, { onConflict: 'player_provider_id,sport_key,season' })
  if (res.error) console.error('[UPSERT][player_season_stats]', res.error)
}

const upsertAts = async (supabase: any, payload: any) => {
  const res = await supabase.from('team_ats_records').upsert(payload, { onConflict: 'team_provider_id,sport_key,season,season_type' })
  if (res.error) console.error('[UPSERT][team_ats_records]', res.error)
}

const upsertOddsRecords = async (supabase: any, payload: any) => {
  const res = await supabase.from('team_odds_records').upsert(payload, { onConflict: 'team_provider_id,sport_key,season' })
  if (res.error) console.error('[UPSERT][team_odds_records]', res.error)
}

const upsertFutures = async (supabase: any, payload: any) => {
  const res = await supabase.from('futures').insert(payload)
  if (res.error) console.error('[INSERT][futures]', res.error)
}

const upsertPredictor = async (supabase: any, payload: any) => {
  const res = await supabase.from('predictor_powerindex').upsert(payload)
  if (res.error) console.error('[UPSERT][predictor_powerindex]', res.error)
}

const upsertTeams = async (supabase: any, payload: any) => {
  const res = await supabase.from('teams').upsert(payload, { onConflict: 'provider_id,sport_key' })
  if (res.error) console.error('[UPSERT][teams]', res.error)
}

const upsertPlayers = async (supabase: any, payload: any) => {
  const res = await supabase.from('players').upsert(payload, { onConflict: 'provider_id,sport_key' })
  if (res.error) console.error('[UPSERT][players]', res.error)
}

const upsertEvents = async (supabase: any, payload: any) => {
  const res = await supabase.from('events').upsert(payload, { onConflict: 'event_id' })
  if (res.error) console.error('[UPSERT][events]', res.error)
}

const upsertTeamGames = async (supabase: any, payload: any) => {
  const res = await supabase.from('team_game_stats').upsert(payload, { onConflict: 'event_id,team_provider_id,sport_key' })
  if (res.error) console.error('[UPSERT][team_game_stats]', res.error)
}

const upsertPlayerGames = async (supabase: any, payload: any) => {
  const res = await supabase.from('player_game_stats').upsert(payload, { onConflict: 'event_id,player_provider_id,sport_key' })
  if (res.error) console.error('[UPSERT][player_game_stats]', res.error)
}

const upsertInjuries = async (supabase: any, payload: any) => {
  const res = await supabase.from('injury_reports').insert(payload)
  if (res.error) console.error('[INSERT][injury_reports]', res.error)
}

const upsertPastPerformances = async (supabase: any, payload: any) => {
  const res = await supabase.from('team_past_performances').upsert(payload, { onConflict: 'team_provider_id,sport_key,provider_id,season' })
  if (res.error) console.error('[UPSERT][team_past_performances]', res.error)
}

const fetchSeasonEvents = async (sport: SportKey, season: number, seasonType: number) => {
  // ESPN scoreboard expects date or date ranges (YYYYMMDD or YYYYMMDD-YYYYMMDD).
  // To capture a full season, sweep Aug 1 of prior year through Aug 1 of the target year.
  const from = `${season - 1}0801`
  const to = `${season}0801`
  const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORT_SCOREBOARD[sport]}/scoreboard?seasontype=${seasonType}&dates=${from}-${to}&limit=2000`
  const data = await fetchJson(url)
  const events: string[] = []
  const items: any[] = data?.events || []
  for (const ev of items) {
    if (ev?.id) events.push(String(ev.id))
  }
  return Array.from(new Set(events))
}

const fetchEventSummary = async (sport: SportKey, eventId: string) => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORT_SCOREBOARD[sport]}/summary?event=${eventId}`
  return fetchJson(url)
}

const ingestEvents = async (supabase: any, cfg: IngestConfig, season: number, eventIds: string[]) => {
  for (const eventId of eventIds) {
    const summary = await fetchEventSummary(cfg.sport, eventId)
    if (!summary) continue

    const competition = summary?.header?.competitions?.[0]
    const competitors: any[] = competition?.competitors || []
    const seasonType = competition?.season?.type ?? cfg.seasonType ?? 2
    const eventDate = competition?.date || summary?.header?.competitions?.[0]?.date
    const status = competition?.status?.type?.description || competition?.status?.type?.detail
    const venue = competition?.venue || summary?.gameInfo?.venue
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')

    await upsertEvents(supabase, {
      event_id: eventId,
      sport_key: cfg.sport,
      season,
      season_type: seasonType,
      date: eventDate,
      status,
      home_team_id: home?.team?.id,
      away_team_id: away?.team?.id,
      venue,
      summary,
    })

    // Team game stats
    const teamStatsPayload: any[] = []
    const boxTeams: any[] = summary?.boxscore?.teams || []
    for (const t of boxTeams) {
      if (!t?.team?.id) continue
      teamStatsPayload.push({
        event_id: eventId,
        team_provider_id: String(t.team.id),
        sport_key: cfg.sport,
        season,
        season_type: seasonType,
        stats: t.statistics || t.stats || t,
        record_at_game: t.record || null,
      })
    }
    if (teamStatsPayload.length) await upsertTeamGames(supabase, teamStatsPayload)

    // Player game stats
    const playerStatsPayload: any[] = []
    const players = summary?.boxscore?.players || []
    for (const teamBlock of players) {
      const teamId = teamBlock?.team?.id
      const statsets: any[] = teamBlock?.statistics || []
      for (const statset of statsets) {
        const athletes: any[] = statset?.athletes || []
        for (const athlete of athletes) {
          if (!athlete?.athlete?.id) continue
          playerStatsPayload.push({
            event_id: eventId,
            player_provider_id: String(athlete.athlete.id),
            team_provider_id: teamId ? String(teamId) : null,
            sport_key: cfg.sport,
            season,
            season_type: seasonType,
            position: athlete.athlete?.position?.abbreviation || athlete.athlete?.position?.name,
            line: athlete.stats || athlete,
            advanced: statset?.labels || null,
          })
        }
      }
    }
    if (playerStatsPayload.length) await upsertPlayerGames(supabase, playerStatsPayload)

    // Predictor / power index
    if (summary?.predictor) {
      await upsertPredictor(supabase, {
        event_id: eventId,
        team_provider_id: null,
        sport_key: cfg.sport,
        payload: summary.predictor,
      })
    } else if (summary?.winprobability?.length) {
      await upsertPredictor(supabase, {
        event_id: eventId,
        team_provider_id: null,
        sport_key: cfg.sport,
        payload: summary.winprobability,
      })
    }
  }
}
const ingestSeason = async (cfg: IngestConfig) => {
  const supabase = getSupabase()
  const teams = await fetchTeamBlock(cfg.sport)
  const sportPath = SPORT_PATH[cfg.sport]

  // Upsert teams base rows
  await upsertTeams(
    supabase,
    teams.map((t: any) => ({
      provider_id: t.id,
      sport_key: cfg.sport,
      abbr: t.abbreviation,
      name: t.displayName || t.name,
      active_from: cfg.seasons[0],
      active_to: cfg.seasons[cfg.seasons.length - 1],
      extra: t,
    }))
  )

  for (const season of cfg.seasons) {
    console.log(`[INGEST][${cfg.sport}] season ${season} teams=${teams.length}`)

    // Futures (once per season)
    const futures = await fetchSbdFutures(cfg.sport)
    if (futures.length) {
      await upsertFutures(
        supabase,
        futures.map((item: any) => ({
          sport_key: cfg.sport,
          season,
          market: item,
        }))
      )
    }

    for (const team of teams) {
      const teamStats = await fetchTeamStatsBlock(cfg.sport, team.id, season)
      if (teamStats?.splits?.categories) {
        await upsertTeamSeason(supabase, {
          team_provider_id: team.id,
          sport_key: cfg.sport,
          season,
          season_type: cfg.seasonType ?? 2,
          stats: teamStats.splits.categories,
        })
      }

      // Betting context (ATS/odds records)
      const ats = await fetchTeamAts(sportPath, season, cfg.seasonType ?? 2, team.id)
      if (ats?.items?.length) {
        await upsertAts(
          supabase,
          ats.items.map((item: any) => ({
            team_provider_id: team.id,
            sport_key: cfg.sport,
            season,
            season_type: cfg.seasonType ?? 2,
            record: item,
          }))
        )
      }

      const oddsRecords = await fetchTeamOddsRecord(sportPath, season, team.id)
      if (oddsRecords?.items?.length) {
        await upsertOddsRecords(
          supabase,
          oddsRecords.items.map((item: any) => ({
            team_provider_id: team.id,
            sport_key: cfg.sport,
            season,
            record: item,
          }))
        )
      }

      // Predictor/PowerIndex requires event context; skipped here (handled per-event job)
      // Past performances (default provider 1003)
      const pastPerf = await fetchTeamPastPerformances(sportPath, team.id, '1003')
      if (pastPerf?.items?.length) {
        await upsertPastPerformances(
          supabase,
          pastPerf.items.map((item: any) => ({
            team_provider_id: team.id,
            sport_key: cfg.sport,
            provider_id: '1003',
            season,
            performances: item,
          }))
        )
      }

      // Roster + player season stats (batched) + players table
      const roster = await fetchRosterBlock(cfg.sport, team.id)
      for (const chunked of chunk(roster, 25)) {
        await Promise.all(
          chunked.map(async (athlete: any) => {
            // Upsert player base
            await upsertPlayers(supabase, {
              provider_id: String(athlete.id),
              sport_key: cfg.sport,
              full_name: athlete.fullName || athlete.displayName,
              positions: athlete.position?.abbreviation ? [athlete.position.abbreviation] : [],
              active_from: season,
              active_to: season,
              team_history: { team: team.abbreviation },
              extra: athlete,
            })

            const stats = await fetchPlayerStatsBlock(cfg.sport, String(athlete.id), season)
            if (stats?.splits?.categories) {
              await upsertPlayerSeason(supabase, {
                player_provider_id: String(athlete.id),
                sport_key: cfg.sport,
                season,
                team_abbr: team.abbreviation,
                position: athlete.position?.abbreviation || athlete.position?.name,
                stats: stats.splits.categories,
                recent: null,
              })
            }
      })
    )
  }
}
  }
}

const main = async () => {
  const cfg = parseArgs()
  await ingestSeason(cfg)

  // Injuries (league-wide)
  const supabase = getSupabase()
  let injuryData: any[] = []
  if (cfg.sport === 'nfl') injuryData = await fetchNflInjuries()
  else if (cfg.sport === 'nba') injuryData = await fetchNbaInjuries()
  else if (cfg.sport === 'mlb') injuryData = await fetchMlbInjuries()
  else if (cfg.sport === 'nhl') injuryData = await fetchNhlInjuries()

  if (injuryData?.length) {
    const rows = injuryData.flatMap((team: any) =>
      (team.injuries || []).map((inj: any) => ({
        sport_key: cfg.sport,
        team_name: team.team?.displayName || 'Unknown',
        player_name: inj.athlete?.displayName || 'Unknown',
        status: inj.status || 'Unknown',
        injury: inj.details?.type || inj.longComment,
        reported_at: inj.date ? new Date(inj.date).toISOString() : null,
      }))
    )
    if (rows.length) await upsertInjuries(supabase, rows)
  }

  // Event-level ingest (per season)
  for (const season of cfg.seasons) {
    const events = await fetchSeasonEvents(cfg.sport, season, cfg.seasonType ?? 2)
    if (events.length) {
      console.log(`[EVENTS][${cfg.sport}] season ${season} events=${events.length}`)
      await ingestEvents(supabase, cfg, season, events)
    }
  }

  console.log('[DONE]', cfg)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
