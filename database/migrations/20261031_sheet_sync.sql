BEGIN;
ALTER TABLE sheet_configurations ADD COLUMN columns jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN remote_revision text, ADD COLUMN last_checked_at timestamptz;
CREATE TABLE sheet_sync_records (
 configuration_id uuid NOT NULL REFERENCES sheet_configurations(id) ON DELETE CASCADE,
 record_id uuid NOT NULL,
 remote_values jsonb NOT NULL DEFAULT '{}',
 last_local_values jsonb NOT NULL DEFAULT '{}',
 remote_deleted boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(configuration_id,record_id)
);
CREATE TABLE sheet_sync_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 configuration_id uuid NOT NULL REFERENCES sheet_configurations(id) ON DELETE CASCADE,
 record_id uuid NOT NULL,
 base_values jsonb NOT NULL,
 proposed_values jsonb NOT NULL,
 fingerprint text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','staged','superseded')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(configuration_id,record_id,fingerprint)
);
CREATE TABLE sheet_sync_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 configuration_id uuid REFERENCES sheet_configurations(id) ON DELETE SET NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 status text NOT NULL DEFAULT 'running',
 details jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE sheet_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sync_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sync_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sheet_sync_records,sheet_sync_proposals,sheet_sync_logs FROM anon,authenticated;
COMMIT;
