create table if not exists blog_game_posts (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  date text not null,
  slug text not null,
  away_team text not null,
  home_team text not null,
  generated_post jsonb not null,
  edge_snapshot jsonb,
  best_lines jsonb,
  line_movements text[],
  splits jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport, date, slug)
);

alter table blog_game_posts enable row level security;

create policy "Public read blog_game_posts"
  on blog_game_posts for select using (true);
