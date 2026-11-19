BEGIN;
GRANT SELECT ON public.service_assurance_rows TO authenticated;
CREATE POLICY controller_realtime_read ON public.service_assurance_rows FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND role IN ('admin','controller')));
-- Existing ticket policies are retained; this only adds the same manager read scope as the API.
CREATE POLICY controller_realtime_read ON public.assurance_tickets FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND role IN ('admin','controller')));
GRANT SELECT ON public.assurance_tickets TO authenticated;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='service_assurance_rows') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.service_assurance_rows;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='assurance_tickets') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.assurance_tickets;
  END IF;
 END IF;
END $$;
COMMIT;
