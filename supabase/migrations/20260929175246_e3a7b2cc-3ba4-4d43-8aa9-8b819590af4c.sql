CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- sports ----------
CREATE TABLE public.sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  period_label TEXT NOT NULL DEFAULT 'Quarters',
  period_count INT NOT NULL DEFAULT 4,
  positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
  team_headline_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports TO anon, authenticated;
GRANT ALL ON public.sports TO service_role;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sports_public_read" ON public.sports FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER sports_updated_at BEFORE UPDATE ON public.sports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sports (slug, name, period_label, period_count, positions, player_stats, team_headline_stats, sort_order) VALUES
('football', 'Football', 'Quarters', 4,
 '["QB","RB","WR","TE","OL","DL","LB","DB","K"]'::jsonb,
 '[{"key":"passing_yards","label":"Passing Yards"},{"key":"rushing_yards","label":"Rushing Yards"},{"key":"receiving_yards","label":"Receiving Yards"},{"key":"touchdowns","label":"Touchdowns"},{"key":"tackles","label":"Tackles"}]'::jsonb,
 '[{"key":"points_for","label":"Points For"},{"key":"points_against","label":"Points Against"}]'::jsonb, 1),
('basketball', 'Basketball', 'Quarters', 4,
 '["PG","SG","SF","PF","C"]'::jsonb,
 '[{"key":"points","label":"Points"},{"key":"rebounds","label":"Rebounds"},{"key":"assists","label":"Assists"},{"key":"steals","label":"Steals"},{"key":"blocks","label":"Blocks"},{"key":"fouls","label":"Fouls"}]'::jsonb,
 '[{"key":"points_for","label":"Points For"},{"key":"points_against","label":"Points Against"}]'::jsonb, 2),
('soccer', 'Soccer', 'Halves', 2,
 '["GK","DEF","MID","FWD"]'::jsonb,
 '[{"key":"goals","label":"Goals"},{"key":"assists","label":"Assists"},{"key":"shots","label":"Shots"},{"key":"saves","label":"Saves"}]'::jsonb,
 '[{"key":"goals_for","label":"Goals For"},{"key":"goals_against","label":"Goals Against"}]'::jsonb, 3);

-- ---------- organizations ----------
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'school',
  city TEXT,
  state TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_type_check CHECK (org_type IN ('school','club','league'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT ON public.organizations TO anon;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- teams ----------
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id),
  name TEXT NOT NULL,
  mascot TEXT,
  level TEXT NOT NULL DEFAULT 'Varsity',
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0B0B0F',
  secondary_color TEXT NOT NULL DEFAULT '#E9E9EF',
  hero_video_url TEXT,
  tagline TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX teams_org_idx ON public.teams(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT ON public.teams TO anon;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- team_members ----------
CREATE TYPE public.team_role AS ENUM ('owner','contributor');

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.team_role NOT NULL DEFAULT 'contributor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX team_members_user_idx ON public.team_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ---------- helper functions ----------
CREATE OR REPLACE FUNCTION public.is_team_manager(_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_published(_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND published = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    JOIN public.team_members m ON m.team_id = t.id
    WHERE t.organization_id = _org_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.team_has_members(_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id);
$$;

-- organizations policies
CREATE POLICY "orgs_public_read" ON public.organizations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "orgs_insert_self" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_update" ON public.organizations FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_manager(id))
  WITH CHECK (created_by = auth.uid() OR public.is_org_manager(id));
CREATE POLICY "orgs_delete" ON public.organizations FOR DELETE TO authenticated USING (created_by = auth.uid());

-- teams policies
CREATE POLICY "teams_public_read" ON public.teams FOR SELECT TO anon, authenticated
  USING (published = true OR public.is_team_manager(id) OR created_by = auth.uid());
CREATE POLICY "teams_insert_self" ON public.teams FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "teams_update_manager" ON public.teams FOR UPDATE TO authenticated
  USING (public.is_team_manager(id) OR created_by = auth.uid())
  WITH CHECK (public.is_team_manager(id) OR created_by = auth.uid());
CREATE POLICY "teams_delete_owner" ON public.teams FOR DELETE TO authenticated
  USING (public.is_team_owner(id) OR created_by = auth.uid());

-- team_members policies
CREATE POLICY "members_read" ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_manager(team_id));
CREATE POLICY "members_insert" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_team_owner(team_id) OR NOT public.team_has_members(team_id));
CREATE POLICY "members_update_owner" ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_team_owner(team_id)) WITH CHECK (public.is_team_owner(team_id));
CREATE POLICY "members_delete_owner" ON public.team_members FOR DELETE TO authenticated
  USING (public.is_team_owner(team_id) OR user_id = auth.uid());

-- ---------- seasons ----------
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '2026',
  year INT NOT NULL DEFAULT 2026,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT SELECT ON public.seasons TO anon;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER seasons_updated_at BEFORE UPDATE ON public.seasons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "seasons_read" ON public.seasons FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "seasons_write" ON public.seasons FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- players ----------
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  jersey_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  grade TEXT,
  level TEXT,
  position TEXT,
  height TEXT,
  weight TEXT,
  hometown TEXT,
  bio TEXT,
  photo_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX players_season_idx ON public.players(season_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT ON public.players TO anon;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "players_read" ON public.players FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "players_write" ON public.players FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- coaches ----------
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  photo_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coaches_season_idx ON public.coaches(season_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches TO authenticated;
GRANT SELECT ON public.coaches TO anon;
GRANT ALL ON public.coaches TO service_role;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER coaches_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "coaches_read" ON public.coaches FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "coaches_write" ON public.coaches FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- games ----------
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  game_date DATE,
  game_time TEXT,
  opponent TEXT NOT NULL,
  opponent_logo_url TEXT,
  home_away TEXT NOT NULL DEFAULT 'home',
  location TEXT,
  team_score INT,
  opponent_score INT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT games_home_away_check CHECK (home_away IN ('home','away','neutral')),
  CONSTRAINT games_status_check CHECK (status IN ('scheduled','final','postponed','canceled'))
);
CREATE INDEX games_season_idx ON public.games(season_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT SELECT ON public.games TO anon;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER games_updated_at BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "games_read" ON public.games FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "games_write" ON public.games FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- player_game_stats ----------
CREATE TABLE public.player_game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_game_stats TO authenticated;
GRANT SELECT ON public.player_game_stats TO anon;
GRANT ALL ON public.player_game_stats TO service_role;
ALTER TABLE public.player_game_stats ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pgs_updated_at BEFORE UPDATE ON public.player_game_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "pgs_read" ON public.player_game_stats FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "pgs_write" ON public.player_game_stats FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- highlights ----------
CREATE TABLE public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlights TO authenticated;
GRANT SELECT ON public.highlights TO anon;
GRANT ALL ON public.highlights TO service_role;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER highlights_updated_at BEFORE UPDATE ON public.highlights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "highlights_read" ON public.highlights FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "highlights_write" ON public.highlights FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- announcements ----------
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "announcements_read" ON public.announcements FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "announcements_write" ON public.announcements FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- get_involved_links ----------
CREATE TABLE public.get_involved_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  link_type TEXT NOT NULL DEFAULT 'other',
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.get_involved_links TO authenticated;
GRANT SELECT ON public.get_involved_links TO anon;
GRANT ALL ON public.get_involved_links TO service_role;
ALTER TABLE public.get_involved_links ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER gil_updated_at BEFORE UPDATE ON public.get_involved_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "gil_read" ON public.get_involved_links FOR SELECT TO anon, authenticated
  USING (public.is_team_published(team_id) OR public.is_team_manager(team_id));
CREATE POLICY "gil_write" ON public.get_involved_links FOR ALL TO authenticated
  USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));

-- ---------- followers ----------
CREATE TABLE public.followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX followers_user_idx ON public.followers(user_id);
GRANT SELECT, INSERT, DELETE ON public.followers TO authenticated;
GRANT ALL ON public.followers TO service_role;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers_read" ON public.followers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_manager(team_id));
CREATE POLICY "followers_insert_self" ON public.followers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "followers_delete_self" ON public.followers FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- storage policies ----------
CREATE POLICY "team_media_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('team-logos','team-photos','team-videos'));
CREATE POLICY "team_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('team-logos','team-photos','team-videos'));
CREATE POLICY "team_media_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('team-logos','team-photos','team-videos') AND owner = auth.uid());
CREATE POLICY "team_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('team-logos','team-photos','team-videos') AND owner = auth.uid());
