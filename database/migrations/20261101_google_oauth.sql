BEGIN;
CREATE TABLE google_oauth_connection (
 id integer PRIMARY KEY CHECK(id=1),
 enabled boolean NOT NULL DEFAULT false,
 email text,
 google_subject text,
 refresh_token_ciphertext text,
 access_token_ciphertext text,
 access_token_expires_at timestamptz,
 connected_by uuid REFERENCES profiles(id),
 connected_at timestamptz,
 version integer NOT NULL DEFAULT 1
);
CREATE TABLE google_oauth_states (
 state_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES profiles(id),
 verifier_ciphertext text NOT NULL,
 connection_version integer NOT NULL,
 expires_at timestamptz NOT NULL
);
ALTER TABLE google_oauth_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON google_oauth_connection,google_oauth_states FROM anon,authenticated;
COMMIT;
