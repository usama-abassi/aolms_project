BEGIN;
CREATE TABLE IF NOT EXISTS delivery_grid_drafts (
 user_id uuid NOT NULL REFERENCES profiles(id),
 id uuid NOT NULL,
 project_id uuid NOT NULL REFERENCES projects(id),
 raw_values jsonb NOT NULL DEFAULT '{}',
 errors jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,
 record_version integer,
 state text NOT NULL CHECK(state IN ('draft','record')),
 mutation_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id)
);
CREATE INDEX IF NOT EXISTS delivery_grid_drafts_project ON delivery_grid_drafts(user_id,project_id);
ALTER TABLE delivery_grid_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON delivery_grid_drafts FROM anon, authenticated;
COMMIT;
