CREATE TABLE public.highlight_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (highlight_id, player_id)
);
GRANT SELECT ON public.highlight_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlight_players TO authenticated;
GRANT ALL ON public.highlight_players TO service_role;
ALTER TABLE public.highlight_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY highlight_players_read ON public.highlight_players FOR SELECT TO anon, authenticated USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
CREATE POLICY highlight_players_write ON public.highlight_players FOR ALL TO authenticated USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));
CREATE TRIGGER highlight_players_updated_at BEFORE UPDATE ON public.highlight_players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, email),
  CONSTRAINT invite_email_format CHECK (email = lower(trim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY invites_owner_read ON public.team_invites FOR SELECT TO authenticated USING (private.is_team_owner(team_id));
CREATE POLICY invites_owner_insert ON public.team_invites FOR INSERT TO authenticated WITH CHECK (private.is_team_owner(team_id) AND invited_by = auth.uid());
CREATE POLICY invites_owner_delete ON public.team_invites FOR DELETE TO authenticated USING (private.is_team_owner(team_id));
CREATE TRIGGER team_invites_updated_at BEFORE UPDATE ON public.team_invites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.followers ADD COLUMN email text;
ALTER TABLE public.followers ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX followers_team_email_unique ON public.followers (team_id, lower(email)) WHERE email IS NOT NULL;
ALTER TABLE public.followers ADD CONSTRAINT follower_email_format CHECK (email IS NULL OR (email = lower(trim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
ALTER TABLE public.followers ADD CONSTRAINT follower_has_identity CHECK (email IS NOT NULL OR user_id IS NOT NULL);
CREATE POLICY followers_manager_read ON public.followers FOR SELECT TO authenticated USING (private.is_team_manager(team_id));

ALTER TABLE public.player_game_stats ADD COLUMN leader_rank integer;
ALTER TABLE public.player_game_stats ADD CONSTRAINT leader_rank_range CHECK (leader_rank IS NULL OR leader_rank BETWEEN 1 AND 3);
CREATE UNIQUE INDEX leader_per_game_rank ON public.player_game_stats (game_id, leader_rank) WHERE leader_rank IS NOT NULL;

CREATE OR REPLACE FUNCTION private.validate_team_relation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE related_team uuid; related_season uuid; game_status text;
BEGIN
  IF TG_TABLE_NAME = 'highlight_players' THEN
    SELECT team_id, season_id INTO related_team, related_season FROM public.highlights WHERE id = NEW.highlight_id;
    IF related_team IS DISTINCT FROM NEW.team_id OR related_season IS DISTINCT FROM NEW.season_id THEN RAISE EXCEPTION 'Clip does not belong to this team season'; END IF;
    SELECT team_id, season_id INTO related_team, related_season FROM public.players WHERE id = NEW.player_id;
    IF related_team IS DISTINCT FROM NEW.team_id OR related_season IS DISTINCT FROM NEW.season_id THEN RAISE EXCEPTION 'Player does not belong to this team season'; END IF;
  ELSIF TG_TABLE_NAME = 'highlights' THEN
    IF NEW.game_id IS NOT NULL THEN
      SELECT team_id, season_id INTO related_team, related_season FROM public.games WHERE id = NEW.game_id;
      IF related_team IS DISTINCT FROM NEW.team_id OR related_season IS DISTINCT FROM NEW.season_id THEN RAISE EXCEPTION 'Game does not belong to this team season'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'player_game_stats' THEN
    SELECT team_id, season_id, status INTO related_team, related_season, game_status FROM public.games WHERE id = NEW.game_id;
    IF related_team IS DISTINCT FROM NEW.team_id OR related_season IS DISTINCT FROM NEW.season_id THEN RAISE EXCEPTION 'Game does not belong to this team season'; END IF;
    SELECT team_id, season_id INTO related_team, related_season FROM public.players WHERE id = NEW.player_id;
    IF related_team IS DISTINCT FROM NEW.team_id OR related_season IS DISTINCT FROM NEW.season_id THEN RAISE EXCEPTION 'Player does not belong to this team season'; END IF;
    IF NEW.leader_rank IS NOT NULL AND game_status <> 'final' THEN RAISE EXCEPTION 'Leaders require a final game'; END IF;
  END IF;
  IF TG_TABLE_NAME <> 'highlight_players' THEN
    SELECT team_id INTO related_team FROM public.seasons WHERE id = NEW.season_id;
    IF related_team IS DISTINCT FROM NEW.team_id THEN RAISE EXCEPTION 'Season does not belong to this team'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_highlight_players BEFORE INSERT OR UPDATE ON public.highlight_players FOR EACH ROW EXECUTE FUNCTION private.validate_team_relation();
CREATE TRIGGER validate_highlights BEFORE INSERT OR UPDATE ON public.highlights FOR EACH ROW EXECUTE FUNCTION private.validate_team_relation();
CREATE TRIGGER validate_leaders BEFORE INSERT OR UPDATE ON public.player_game_stats FOR EACH ROW EXECUTE FUNCTION private.validate_team_relation();
CREATE TRIGGER validate_involved BEFORE INSERT OR UPDATE ON public.get_involved_links FOR EACH ROW EXECUTE FUNCTION private.validate_team_relation();

CREATE OR REPLACE FUNCTION public.claim_team_invites() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed integer := 0; verified_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  verified_email := lower(trim(auth.jwt()->>'email'));
  IF verified_email IS NULL OR verified_email = '' OR (auth.jwt()->>'role') <> 'authenticated' THEN RETURN 0; END IF;
  INSERT INTO public.team_members (team_id, user_id, role)
  SELECT i.team_id, auth.uid(), 'contributor'::public.team_role
  FROM public.team_invites i WHERE i.email = verified_email
  ON CONFLICT (team_id, user_id) DO NOTHING;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  DELETE FROM public.team_invites i WHERE i.email = verified_email AND EXISTS
    (SELECT 1 FROM public.team_members m WHERE m.team_id = i.team_id AND m.user_id = auth.uid());
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_team_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_team_invites() TO authenticated, service_role;

DROP POLICY members_insert ON public.team_members;
CREATE POLICY members_insert ON public.team_members FOR INSERT TO authenticated WITH CHECK (
  (private.is_team_owner(team_id) AND role = 'contributor') OR
  (NOT private.team_has_members(team_id) AND role = 'owner' AND EXISTS
    (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()))
);
DROP POLICY members_update_owner ON public.team_members;
CREATE POLICY members_update_owner ON public.team_members FOR UPDATE TO authenticated USING (private.is_team_owner(team_id) AND role = 'contributor') WITH CHECK (private.is_team_owner(team_id) AND role = 'contributor');
DROP POLICY members_delete_owner ON public.team_members;
CREATE POLICY members_delete_owner ON public.team_members FOR DELETE TO authenticated USING ((private.is_team_owner(team_id) AND role = 'contributor') OR (user_id = auth.uid() AND role = 'contributor'));

CREATE TABLE public.follow_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);
GRANT ALL ON public.follow_rate_limits TO service_role;
ALTER TABLE public.follow_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER follow_rate_limits_updated_at BEFORE UPDATE ON public.follow_rate_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.follow_team_by_email(_team_id uuid, _email text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE clean_email text := lower(trim(_email)); hits integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND published = true) THEN RAISE EXCEPTION 'Team not available'; END IF;
  IF length(clean_email) > 254 OR clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter a valid email address'; END IF;
  INSERT INTO public.follow_rate_limits (email) VALUES (clean_email)
  ON CONFLICT (email) DO UPDATE SET attempts = CASE WHEN public.follow_rate_limits.window_start < now() - interval '1 day' THEN 1 ELSE public.follow_rate_limits.attempts + 1 END,
  window_start = CASE WHEN public.follow_rate_limits.window_start < now() - interval '1 day' THEN now() ELSE public.follow_rate_limits.window_start END
  RETURNING attempts INTO hits;
  IF hits > 8 THEN RAISE EXCEPTION 'Too many requests. Try again tomorrow'; END IF;
  INSERT INTO public.followers(team_id, email) VALUES (_team_id, clean_email) ON CONFLICT DO NOTHING;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.follow_team_by_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.follow_team_by_email(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.team_follower_count(_team_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT CASE WHEN EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND published = true) THEN
 (SELECT count(*)::integer FROM public.followers WHERE team_id = _team_id) ELSE 0 END;
$$;
REVOKE ALL ON FUNCTION public.team_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_follower_count(uuid) TO anon, authenticated, service_role;

DROP POLICY team_media_insert ON storage.objects;
CREATE POLICY team_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  (bucket_id IN ('team-logos','team-photos') AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.teams WHERE private.is_team_manager(id)))
  OR (bucket_id = 'team-videos' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.teams WHERE private.is_team_manager(id)))
  OR (bucket_id = 'team-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
);