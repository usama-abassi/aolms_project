BEGIN;
CREATE TABLE sheet_configurations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 month date NOT NULL CHECK (extract(day from month)=1),
 spreadsheet_id text NOT NULL,
 sheet_url text NOT NULL,
 tab_name text NOT NULL CHECK (length(tab_name) BETWEEN 1 AND 100),
 version integer NOT NULL DEFAULT 1,
 last_success_at timestamptz,
 last_attempt_at timestamptz,
 sync_status text NOT NULL DEFAULT 'not_started',
 latest_error text,
 created_by uuid NOT NULL REFERENCES profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
CREATE UNIQUE INDEX sheet_configurations_project_month ON sheet_configurations(project_id,month) WHERE deleted_at IS NULL;
ALTER TABLE sheet_configurations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sheet_configurations FROM anon,authenticated;
-- Access is exclusively through authenticated admin/controller server endpoints.
COMMIT;
