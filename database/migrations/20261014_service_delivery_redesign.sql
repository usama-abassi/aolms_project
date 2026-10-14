BEGIN;
ALTER TABLE assurance_submissions ADD COLUMN IF NOT EXISTS delivery_fields jsonb NOT NULL DEFAULT '{}';
-- Existing columns and JSON remain intact. New sheet-only fields live in spreadsheet_fields.delivery.
NOTIFY pgrst, 'reload schema';
COMMIT;
