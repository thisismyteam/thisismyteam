DROP POLICY members_insert ON public.team_members;
CREATE POLICY members_insert ON public.team_members FOR INSERT TO authenticated WITH CHECK (
  (role = 'owner' AND user_id = auth.uid() AND NOT private.team_has_members(team_id) AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()))
  OR (role = 'contributor' AND private.is_team_owner(team_id))
);
DROP POLICY members_update_owner ON public.team_members;
CREATE POLICY members_update_owner ON public.team_members FOR UPDATE TO authenticated USING (private.is_team_owner(team_id) AND role = 'contributor') WITH CHECK (private.is_team_owner(team_id) AND role = 'contributor');
DROP POLICY members_delete_owner ON public.team_members;
CREATE POLICY members_delete_owner ON public.team_members FOR DELETE TO authenticated USING (role = 'contributor' AND (private.is_team_owner(team_id) OR user_id = auth.uid()));