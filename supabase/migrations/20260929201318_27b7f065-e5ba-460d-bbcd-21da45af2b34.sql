DROP POLICY team_media_insert ON storage.objects;
CREATE POLICY team_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id IN ('team-logos','team-photos','team-videos') AND (
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.teams WHERE private.is_team_manager(id) OR created_by = auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (bucket_id = 'team-logos' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE created_by = auth.uid()))
  )
);