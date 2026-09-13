-- Виконай цей файл у Supabase: Project → SQL Editor → New query → вставити → Run

create table if not exists diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer,
  media_type text check (media_type in ('movie', 'tv')) default 'movie',
  title text not null,
  year text,
  poster_path text,
  status text check (status in ('watching', 'watched', 'planned')) default 'planned',
  rating numeric check (rating >= 0 and rating <= 10),
  notes text,
  watched_date date,
  created_at timestamptz not null default now()
);

alter table diary_entries enable row level security;

create policy "select own entries" on diary_entries
  for select using (auth.uid() = user_id);

create policy "insert own entries" on diary_entries
  for insert with check (auth.uid() = user_id);

create policy "update own entries" on diary_entries
  for update using (auth.uid() = user_id);

create policy "delete own entries" on diary_entries
  for delete using (auth.uid() = user_id);
