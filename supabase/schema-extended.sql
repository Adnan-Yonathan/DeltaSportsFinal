-- Supabase schema prompts for expanded ESPN ingest (season + game + betting without odds)
-- Run pieces as needed in the SQL editor before ingestion scripts.

-- Core reference tables
create table if not exists teams (
  id uuid default gen_random_uuid() primary key,
  provider_id text not null,
  sport_key text not null,
  abbr text,
  name text,
  active_from int,
  active_to int,
  extra jsonb,
  unique (provider_id, sport_key)
);

create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  provider_id text not null,
  sport_key text not null,
  full_name text,
  positions text[],
  active_from int,
  active_to int,
  team_history jsonb,
  extra jsonb,
  unique (provider_id, sport_key)
);

-- Season aggregates
create table if not exists team_season_stats (
  id uuid default gen_random_uuid() primary key,
  team_provider_id text not null,
  sport_key text not null,
  season int not null,
  season_type int default 2,
  stats jsonb not null,
  captured_at timestamptz default now(),
  unique (team_provider_id, sport_key, season, season_type)
);

create table if not exists player_season_stats (
  id uuid default gen_random_uuid() primary key,
  player_provider_id text not null,
  sport_key text not null,
  season int not null,
  team_abbr text,
  position text,
  stats jsonb not null,
  recent jsonb,
  captured_at timestamptz default now(),
  unique (player_provider_id, sport_key, season)
);

-- Events / schedules
create table if not exists events (
  event_id text primary key,
  sport_key text not null,
  season int,
  season_type int,
  date timestamptz,
  status text,
  home_team_id text,
  away_team_id text,
  venue jsonb,
  summary jsonb,
  created_at timestamptz default now()
);

-- Game-level stats (partition by season if desired)
create table if not exists team_game_stats (
  id uuid default gen_random_uuid() primary key,
  event_id text not null,
  team_provider_id text not null,
  sport_key text not null,
  season int,
  season_type int,
  stats jsonb not null,
  record_at_game jsonb,
  captured_at timestamptz default now(),
  unique (event_id, team_provider_id, sport_key)
);

create table if not exists player_game_stats (
  id uuid default gen_random_uuid() primary key,
  event_id text not null,
  player_provider_id text not null,
  team_provider_id text,
  sport_key text not null,
  season int,
  season_type int,
  position text,
  line jsonb not null,
  advanced jsonb,
  captured_at timestamptz default now(),
  unique (event_id, player_provider_id, sport_key)
);

-- Injuries
create table if not exists injury_reports (
  id uuid default gen_random_uuid() primary key,
  sport_key text not null,
  team_name text,
  player_name text,
  status text,
  injury text,
  reported_at timestamptz,
  captured_at timestamptz default now()
);

-- Limited betting (no odds fetch)
create table if not exists team_ats_records (
  id uuid default gen_random_uuid() primary key,
  team_provider_id text not null,
  sport_key text not null,
  season int not null,
  season_type int default 2,
  record jsonb not null,
  captured_at timestamptz default now(),
  unique (team_provider_id, sport_key, season, season_type)
);

create table if not exists team_odds_records (
  id uuid default gen_random_uuid() primary key,
  team_provider_id text not null,
  sport_key text not null,
  season int not null,
  record jsonb not null,
  captured_at timestamptz default now(),
  unique (team_provider_id, sport_key, season)
);

create table if not exists futures (
  id uuid default gen_random_uuid() primary key,
  sport_key text not null,
  season int not null,
  market jsonb not null,
  captured_at timestamptz default now()
);

create table if not exists predictor_powerindex (
  id uuid default gen_random_uuid() primary key,
  event_id text,
  team_provider_id text,
  sport_key text not null,
  payload jsonb not null,
  captured_at timestamptz default now()
);

-- Optional: past performances by provider (if used)
create table if not exists team_past_performances (
  id uuid default gen_random_uuid() primary key,
  team_provider_id text not null,
  sport_key text not null,
  provider_id text not null,
  season int,
  performances jsonb not null,
  captured_at timestamptz default now()
);

-- Indexes
create index if not exists idx_team_season_sport on team_season_stats (sport_key, season);
create index if not exists idx_player_season_sport on player_season_stats (sport_key, season);
create index if not exists idx_events_sport_season on events (sport_key, season);
create index if not exists idx_team_game_sport on team_game_stats (sport_key, season);
create index if not exists idx_player_game_sport on player_game_stats (sport_key, season);
create index if not exists idx_injuries_sport on injury_reports (sport_key, captured_at);
create index if not exists idx_team_ats_sport on team_ats_records (sport_key, season);
create index if not exists idx_team_odds_sport on team_odds_records (sport_key, season);
create index if not exists idx_futures_sport on futures (sport_key, season);
create index if not exists idx_predictor_sport on predictor_powerindex (sport_key, captured_at);
create index if not exists idx_past_perf_sport on team_past_performances (sport_key, provider_id);

-- JSONB helper indexes
create index if not exists gin_team_season_stats on team_season_stats using gin (stats);
create index if not exists gin_player_season_stats on player_season_stats using gin (stats);
create index if not exists gin_team_game_stats on team_game_stats using gin (stats);
create index if not exists gin_player_game_stats on player_game_stats using gin (line);
