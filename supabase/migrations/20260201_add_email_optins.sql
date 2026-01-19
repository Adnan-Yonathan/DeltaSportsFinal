create table if not exists public.email_optins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  last_trade_id text
);

create index if not exists idx_email_optins_status on public.email_optins (status);
