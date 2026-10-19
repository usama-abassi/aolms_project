BEGIN;
ALTER TABLE service_assurance_responses ADD COLUMN IF NOT EXISTS ticket_number text;
ALTER TABLE service_assurance_responses ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE service_assurance_responses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE service_assurance_responses ADD COLUMN IF NOT EXISTS submitted_values jsonb;
ALTER TABLE service_assurance_responses ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES profiles(id);
ALTER TABLE service_assurance_responses ALTER COLUMN submitted_at DROP NOT NULL;
UPDATE service_assurance_responses s SET ticket_number=btrim(r.raw_values->>'ticket_number')
FROM service_assurance_rows r WHERE r.id=s.row_id AND s.ticket_number IS NULL;
UPDATE service_assurance_responses SET submitted_values=raw_values WHERE submitted_at IS NOT NULL AND submitted_values IS NULL;
UPDATE service_assurance_responses SET submitted_by=technician_id WHERE submitted_at IS NOT NULL AND submitted_by IS NULL;
CREATE INDEX IF NOT EXISTS service_assurance_response_ticket ON service_assurance_responses(ticket_number,updated_at DESC);
CREATE INDEX IF NOT EXISTS service_assurance_latest_ticket ON service_assurance_rows(project_id,(btrim(raw_values->>'ticket_number')),created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS equipment_ont_serial_normalized ON equipment_records((lower(btrim(data->>'serial_number')))) WHERE kind='ont';
COMMIT;
