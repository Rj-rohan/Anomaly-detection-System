-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null default 'user' check (role in ('user','admin','analyst')),
  created_at timestamptz default now()
);

create table if not exists login_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  timestamp timestamptz not null,
  status text not null check (status in ('success','failed')),
  ip_address text,
  device text,
  browser text,
  location text
);

create table if not exists user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique references users(id) on delete cascade,
  avg_login_hour numeric,
  common_login_days text[],
  avg_failed_attempts numeric default 0
);

create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  risk_score int not null,
  reason text,
  severity text check (severity in ('Low','Medium','High','Critical')),
  status text default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);

create table if not exists incidents (
  id uuid primary key default uuid_generate_v4(),
  alert_id uuid references alerts(id) on delete cascade,
  assigned_to uuid references users(id),
  notes text default '',
  status text default 'New' check (status in ('New','Investigating','Resolved','Escalated')),
  updated_at timestamptz default now()
);

-- Disable RLS for backend service key access
alter table users disable row level security;
alter table login_logs disable row level security;
alter table user_profiles disable row level security;
alter table alerts disable row level security;
alter table incidents disable row level security;
