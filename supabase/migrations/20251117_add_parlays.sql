-- Create parlays and parlay_picks tables to track multi-leg bets

create table if not exists public.parlays (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid,
  stake numeric not null check (stake >= 0),
  combined_decimal_odds numeric not null,
  combined_american_odds numeric not null,
  potential_payout numeric not null,
  status text not null default 'pending' check (status in ('pending','won','lost','push','void','canceled')),
  result text,
  settled_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.parlay_picks (
  id uuid primary key default uuid_generate_v4(),
  parlay_id uuid not null references public.parlays(id) on delete cascade,
  sport text,
  league text,
  game_description text,
  event_id text,
  market text,
  selection text,
  line numeric,
  odds numeric not null,
  book text,
  result text default 'pending' check (result in ('pending','won','lost','push','void')),
  created_at timestamp with time zone default now()
);

create index if not exists idx_parlays_user_status on public.parlays(user_id, status);
create index if not exists idx_parlay_picks_parlay on public.parlay_picks(parlay_id);
