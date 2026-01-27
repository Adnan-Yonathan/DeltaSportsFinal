create table if not exists public.odds_cache (
  cache_key text primary key,
  sport text not null,
  markets text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists odds_cache_updated_at_idx on public.odds_cache (updated_at);
