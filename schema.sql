-- Run this in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)

-- ── Tasks ─────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  description text,
  layer       text check (layer in ('fe','be','full','ai')),
  tech        text[] default '{}',
  priority    text check (priority in ('mvp','v2','v3')) default 'mvp',
  status      text check (status in ('todo','in_progress','done')) default 'todo',
  assigned_to text,
  created_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Members (display + colour) ────────────────────────────────────────────────
create table if not exists members (
  id        uuid default gen_random_uuid() primary key,
  name      text not null unique,
  color     text not null default '#c9a84c',
  joined_at timestamptz default now()
);

-- ── Users (accounts with hashed passwords) ────────────────────────────────────
create table if not exists users (
  id           uuid default gen_random_uuid() primary key,
  username     text not null unique,
  password     text not null,          -- bcrypt hash, never plain text
  color        text not null default '#c9a84c',
  created_at   timestamptz default now()
);

-- ── Real-time ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table members;

-- ── Row Level Security (public access, PIN + auth handled in app) ─────────────
alter table tasks   enable row level security;
alter table members enable row level security;
alter table users   enable row level security;

create policy "public_tasks"   on tasks   for all using (true) with check (true);
create policy "public_members" on members for all using (true) with check (true);
create policy "public_users"   on users   for all using (true) with check (true);