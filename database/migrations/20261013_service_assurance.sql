BEGIN;
CREATE TABLE IF NOT EXISTS service_assurance_rows (
 id uuid PRIMARY KEY,
 project_id uuid NOT NULL REFERENCES projects(id),
 technician_id uuid REFERENCES profiles(id),
 raw_values jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,
 mutation_id uuid NOT NULL,
 updated_by uuid NOT NULL REFERENCES profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_assurance_rows_project ON service_assurance_rows(project_id,created_at,id);
CREATE INDEX IF NOT EXISTS service_assurance_rows_technician ON service_assurance_rows(technician_id);
CREATE TABLE IF NOT EXISTS service_assurance_responses (
 row_id uuid PRIMARY KEY REFERENCES service_assurance_rows(id),
 technician_id uuid NOT NULL REFERENCES profiles(id),
 raw_values jsonb NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE service_assurance_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_assurance_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON service_assurance_rows,service_assurance_responses FROM anon,authenticated;
COMMIT;
