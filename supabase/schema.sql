-- Kannada Kasthuri Supabase Database Schema
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Playlists Table
CREATE TABLE IF NOT EXISTS public.playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    bg_landscape TEXT DEFAULT '/bg/bg-video.mp4',
    bg_portrait TEXT DEFAULT '/bg/Portrait-mobile.png',
    tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read playlists" ON public.playlists
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert playlists" ON public.playlists
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update playlists" ON public.playlists
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete playlists" ON public.playlists
    FOR DELETE USING (true);


-- 2. Real-Time Active Sessions Table (for 100% accurate live online user counting)
CREATE TABLE IF NOT EXISTS public.active_sessions (
    session_id TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on active_sessions
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read active_sessions" ON public.active_sessions
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert active_sessions" ON public.active_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update active_sessions" ON public.active_sessions
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete active_sessions" ON public.active_sessions
    FOR DELETE USING (true);
