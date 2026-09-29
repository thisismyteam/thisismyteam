CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_team_manager(_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.is_team_owner(_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = auth.uid() AND role = 'owner');
$$;

CREATE OR REPLACE FUNCTION private.is_team_published(_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND published = true);
$$;

CREATE OR REPLACE FUNCTION private.is_org_manager(_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t JOIN public.team_members m ON m.team_id = t.id
    WHERE t.organization_id = _org_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.team_has_members(_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id);
$$;

GRANT EXECUTE ON FUNCTION private.is_team_manager(uuid), private.is_team_owner(uuid), private.is_team_published(uuid), private.is_org_manager(uuid), private.team_has_members(uuid) TO anon, authenticated, service_role;

-- Recreate policies against the private helpers
DROP POLICY "orgs_update" ON public.organizations;
CREATE POLICY "orgs_update" ON public.organizations FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR private.is_org_manager(id))
  WITH CHECK (created_by = auth.uid() OR private.is_org_manager(id));

DROP POLICY "teams_public_read" ON public.teams;
CREATE POLICY "teams_public_read" ON public.teams FOR SELECT TO anon, authenticated
  USING (published = true OR private.is_team_manager(id) OR created_by = auth.uid());
DROP POLICY "teams_update_manager" ON public.teams;
CREATE POLICY "teams_update_manager" ON public.teams FOR UPDATE TO authenticated
  USING (private.is_team_manager(id) OR created_by = auth.uid())
  WITH CHECK (private.is_team_manager(id) OR created_by = auth.uid());
DROP POLICY "teams_delete_owner" ON public.teams;
CREATE POLICY "teams_delete_owner" ON public.teams FOR DELETE TO authenticated
  USING (private.is_team_owner(id) OR created_by = auth.uid());

DROP POLICY "members_read" ON public.team_members;
CREATE POLICY "members_read" ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_team_manager(team_id));
DROP POLICY "members_insert" ON public.team_members;
CREATE POLICY "members_insert" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (private.is_team_owner(team_id) OR NOT private.team_has_members(team_id));
DROP POLICY "members_update_owner" ON public.team_members;
CREATE POLICY "members_update_owner" ON public.team_members FOR UPDATE TO authenticated
  USING (private.is_team_owner(team_id)) WITH CHECK (private.is_team_owner(team_id));
DROP POLICY "members_delete_owner" ON public.team_members;
CREATE POLICY "members_delete_owner" ON public.team_members FOR DELETE TO authenticated
  USING (private.is_team_owner(team_id) OR user_id = auth.uid());

DROP POLICY "seasons_read" ON public.seasons;
CREATE POLICY "seasons_read" ON public.seasons FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "seasons_write" ON public.seasons;
CREATE POLICY "seasons_write" ON public.seasons FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "players_read" ON public.players;
CREATE POLICY "players_read" ON public.players FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "players_write" ON public.players;
CREATE POLICY "players_write" ON public.players FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "coaches_read" ON public.coaches;
CREATE POLICY "coaches_read" ON public.coaches FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "coaches_write" ON public.coaches;
CREATE POLICY "coaches_write" ON public.coaches FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "games_read" ON public.games;
CREATE POLICY "games_read" ON public.games FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "games_write" ON public.games;
CREATE POLICY "games_write" ON public.games FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "pgs_read" ON public.player_game_stats;
CREATE POLICY "pgs_read" ON public.player_game_stats FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "pgs_write" ON public.player_game_stats;
CREATE POLICY "pgs_write" ON public.player_game_stats FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "highlights_read" ON public.highlights;
CREATE POLICY "highlights_read" ON public.highlights FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "highlights_write" ON public.highlights;
CREATE POLICY "highlights_write" ON public.highlights FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "announcements_read" ON public.announcements;
CREATE POLICY "announcements_read" ON public.announcements FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "announcements_write" ON public.announcements;
CREATE POLICY "announcements_write" ON public.announcements FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "gil_read" ON public.get_involved_links;
CREATE POLICY "gil_read" ON public.get_involved_links FOR SELECT TO anon, authenticated
  USING (private.is_team_published(team_id) OR private.is_team_manager(team_id));
DROP POLICY "gil_write" ON public.get_involved_links;
CREATE POLICY "gil_write" ON public.get_involved_links FOR ALL TO authenticated
  USING (private.is_team_manager(team_id)) WITH CHECK (private.is_team_manager(team_id));

DROP POLICY "followers_read" ON public.followers;
CREATE POLICY "followers_read" ON public.followers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_team_manager(team_id));

DROP FUNCTION public.is_team_manager(uuid);
DROP FUNCTION public.is_team_owner(uuid);
DROP FUNCTION public.is_team_published(uuid);
DROP FUNCTION public.is_org_manager(uuid);
DROP FUNCTION public.team_has_members(uuid);
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
