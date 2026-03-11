-- Run this in Supabase SQL Editor

create table tasks (
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

-- Enable real-time
alter publication supabase_realtime add table tasks;

-- Anyone with the URL can read/write (no auth needed)
alter table tasks enable row level security;
create policy "public_all" on tasks for all using (true) with check (true);