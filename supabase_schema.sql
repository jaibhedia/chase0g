-- ==========================================
-- CHASE Game: Supabase Database Schema
-- ==========================================

-- 1. Create 'games' table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    state JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in-progress', 'finished')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create 'game_players' table
CREATE TABLE game_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT,
    character_id INTEGER NOT NULL,
    is_host BOOLEAN DEFAULT false NOT NULL,
    player_state JSONB DEFAULT '{}'::jsonb,
    score INTEGER DEFAULT 0 NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(game_id, player_id)
);

-- 3. Create 'game_events' table
CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create 'player_stats' table
CREATE TABLE player_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id TEXT UNIQUE NOT NULL,
    player_name TEXT,
    total_games INTEGER DEFAULT 0 NOT NULL,
    wins INTEGER DEFAULT 0 NOT NULL,
    total_tags INTEGER DEFAULT 0 NOT NULL,
    avg_tags_per_game NUMERIC(5,2) DEFAULT 0 NOT NULL,
    power_ups_used INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_games_room_code ON games(room_code);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_player_id ON game_players(player_id);
CREATE INDEX idx_game_events_game_id ON game_events(game_id);
CREATE INDEX idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX idx_player_stats_wins ON player_stats(wins DESC);

-- ==========================================
-- REALTIME SETUP
-- ==========================================
-- Enable Replication so socket listeners can hear events
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;

-- ==========================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- ==========================================
-- (Optional but recommended: Set your DB to public execution for dev)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to games" ON games FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to games" ON games FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous read access to game_players" ON game_players FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to game_players" ON game_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to game_players" ON game_players FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous read access to game_events" ON game_events FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to game_events" ON game_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to player_stats" ON player_stats FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access to player_stats" ON player_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to player_stats" ON player_stats FOR UPDATE USING (true);
