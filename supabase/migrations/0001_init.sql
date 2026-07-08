-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Concepts table for tracking mastery per subject/concept
create table if not exists public.concepts (
  id uuid primary key default uuid_generate_v4(),
  subject text not null,
  concept text not null,
  mastery_score numeric(4,2) not null default 0,
  mastery_level text,
  overview_gist text,
  deep_dive_gist text[],
  strong_areas text[],
  weak_areas text[],
  next_steps text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject, concept)
);

-- Chats table
create table if not exists public.chats (
  id uuid primary key default uuid_generate_v4(),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages table
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_concepts_subject on public.concepts(subject);
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);

-- Note: create the storage bucket in Supabase Dashboard or via the management API.
-- For SQL editor, the bucket can be created from the Dashboard with:
-- Name: chat-images
-- Public bucket: true
-- File size limit: as desired
-- Allowed MIME types: image/*
