-- Run this in Supabase SQL Editor
-- (If you already ran the old schema, just run the NEW parts at the bottom)

-- ── Tasks table ──────────────────────────────────────────────────────────────
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  layer text check (layer in ('fe','be','full','ai')),
  tech text[] default '{}',
  priority text check (priority in ('mvp','v2','v3')) default 'mvp',
  status text check (status in ('todo','in_progress','done')) default 'todo',
  assigned_to text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Members table (NEW) ───────────────────────────────────────────────────────
create table if not exists members (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  color text not null default '#c9a84c',
  joined_at timestamptz default now()
);

-- Enable real-time on both tables
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table members;

-- Public read/write (PIN is handled in the app)
alter table tasks enable row level security;
create policy "public_all_tasks" on tasks for all using (true) with check (true);

alter table members enable row level security;
create policy "public_all_members" on members for all using (true) with check (true);