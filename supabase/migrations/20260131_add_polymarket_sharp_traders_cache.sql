create table if not exists public.polymarket_sharp_traders_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

comment on table public.polymarket_sharp_traders_cache is 'Cached payloads for deprecated wallet analytics API.';
