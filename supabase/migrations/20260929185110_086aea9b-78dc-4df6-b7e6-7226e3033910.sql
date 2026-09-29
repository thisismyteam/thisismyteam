CREATE POLICY follow_rate_limits_service_only ON public.follow_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER FUNCTION public.claim_team_invites() RENAME TO claim_team_invites_internal;
ALTER FUNCTION public.claim_team_invites_internal() SET SCHEMA private;
CREATE OR REPLACE FUNCTION private.claim_team_invites_internal() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed integer := 0; verified_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO verified_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF verified_email IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.team_members (team_id, user_id, role)
  SELECT i.team_id, auth.uid(), 'contributor'::public.team_role FROM public.team_invites i WHERE i.email = verified_email
  ON CONFLICT (team_id, user_id) DO NOTHING;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  DELETE FROM public.team_invites i WHERE i.email = verified_email AND EXISTS
    (SELECT 1 FROM public.team_members m WHERE m.team_id = i.team_id AND m.user_id = auth.uid());
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION private.claim_team_invites_internal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.claim_team_invites_internal() TO authenticated;
CREATE FUNCTION public.claim_team_invites() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.claim_team_invites_internal(); $$;
REVOKE ALL ON FUNCTION public.claim_team_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_team_invites() TO authenticated;

ALTER FUNCTION public.follow_team_by_email(uuid, text) RENAME TO follow_team_by_email_internal;
ALTER FUNCTION public.follow_team_by_email_internal(uuid, text) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.follow_team_by_email_internal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.follow_team_by_email_internal(uuid, text) TO anon, authenticated;
CREATE FUNCTION public.follow_team_by_email(_team_id uuid, _email text) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.follow_team_by_email_internal(_team_id, _email); $$;
REVOKE ALL ON FUNCTION public.follow_team_by_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.follow_team_by_email(uuid, text) TO anon, authenticated;

ALTER FUNCTION public.team_follower_count(uuid) RENAME TO team_follower_count_internal;
ALTER FUNCTION public.team_follower_count_internal(uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.team_follower_count_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.team_follower_count_internal(uuid) TO anon, authenticated;
CREATE FUNCTION public.team_follower_count(_team_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.team_follower_count_internal(_team_id); $$;
REVOKE ALL ON FUNCTION public.team_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_follower_count(uuid) TO anon, authenticated;