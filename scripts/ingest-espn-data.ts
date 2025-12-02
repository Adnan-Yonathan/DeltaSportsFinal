/**
 * Lightweight ESPN ingest for Supabase: season-level team/player stats and optional betting context (futures/ATS/odds records/predictor).
 * Usage: ts-node scripts/ingest-espn-data.ts --sport nfl --seasons 2020,2021,2022,2023,2024
 */
import { createServiceClient } from '@/lib/supabase/service'
import { fetchTeamList as fetchNflTeams, fetchRoster as fetchNflRoster, fetchTeamStatistics as fetchNflTeamStats, fetchAthleteStatistics as fetchNflAthleteStats } from '@/lib/providers/espn-nfl'
import { fetchTeamList as fetchNbaTeams, fetchRoster as fetchNbaRoster, fetchTeamStatistics as fetchNbaTeamStats, fetchAthleteStatistics as fetchNbaAthleteStats } from '@/lib/providers/espn-nba'
import { fetchTeamList as fetchMlbTeams, fetchRoster as fetchMlbRoster, fetchTeamStatistics as fetchMlbTeamStats, fetchAthleteStatistics as fetchMlbAthleteStats } from '@/lib/providers/espn-mlb'
import { fetchTeamList as fetchNhlTeams, fetchRoster as fetchNhlRoster, fetchTeamStatistics as fetchNhlTeamStats, fetchAthleteStatistics as fetchNhlAthleteStats } from '@/lib/providers/espn-nhl'
import {
  fetchFutures,
  fetchTeamAts,
  fetchTeamOddsRecord,
  fetchPredictor,
  fetchPowerIndex,
} from '@/lib/providers/espn-betting'

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
  await supabase.from('team_season_stats').upsert(payload, { onConflict: 'team_provider_id,sport_key,season,season_type' })
}

const upsertPlayerSeason = async (supabase: any, payload: any) => {
  await supabase.from('player_season_stats').upsert(payload, { onConflict: 'player_provider_id,sport_key,season' })
}

const upsertAts = async (supabase: any, payload: any) => {
  await supabase.from('team_ats_records').upsert(payload, { onConflict: 'team_provider_id,sport_key,season,season_type' })
}

const upsertOddsRecords = async (supabase: any, payload: any) => {
  await supabase.from('team_odds_records').upsert(payload, { onConflict: 'team_provider_id,sport_key,season' })
}

const upsertFutures = async (supabase: any, payload: any) => {
  await supabase.from('futures').insert(payload)
}

const upsertPredictor = async (supabase: any, payload: any) => {
  await supabase.from('predictor_powerindex').upsert(payload)
}

const ingestSeason = async (cfg: IngestConfig) => {
  const supabase = getSupabase()
  const teams = await fetchTeamBlock(cfg.sport)
  const sportPath = SPORT_PATH[cfg.sport]

  for (const season of cfg.seasons) {
    console.log(`[INGEST][${cfg.sport}] season ${season} teams=${teams.length}`)

    // Futures (once per season)
    const futures = await fetchFutures(sportPath, season)
    if (futures?.items?.length) {
      await upsertFutures(
        supabase,
        futures.items.map((item: any) => ({
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

      // Roster + player season stats (batched)
      const roster = await fetchRosterBlock(cfg.sport, team.id)
      for (const chunked of chunk(roster, 25)) {
        await Promise.all(
          chunked.map(async (athlete: any) => {
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
  console.log('[DONE]', cfg)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
