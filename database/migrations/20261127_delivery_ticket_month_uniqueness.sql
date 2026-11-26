BEGIN;
SET LOCAL lock_timeout = '8s';
CREATE UNIQUE INDEX IF NOT EXISTS assurance_tickets_project_month_ticket_uidx
 ON public.assurance_tickets (project_id, (date_trunc('month', work_date::timestamp)), (btrim(ticket_number)));
ALTER TABLE public.assurance_tickets DROP CONSTRAINT IF EXISTS assurance_tickets_ticket_number_key;
COMMIT;
