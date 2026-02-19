create table if not exists public.prop_orderbooks_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists prop_orderbooks_cache_fetched_at_idx
  on public.prop_orderbooks_cache (fetched_at);

comment on table public.prop_orderbooks_cache is 'Cached payloads for sharp props orderbooks API.';
