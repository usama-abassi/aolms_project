# Google Sheets integration

## Deployment

1. Apply these additive migrations, in order, using the project's normal PostgreSQL migration process:
   - `database/migrations/20261031_sheet_configuration.sql`
   - `database/migrations/20261031_sheet_sync.sql`
   - `database/migrations/20261031_controller_realtime.sql`
   - `database/migrations/20261101_google_oauth.sql`
2. Set up Google OAuth as described below and a strong server-only `CRON_SECRET`. The legacy service-account environment variables remain optional for installations that have never connected a personal account.
3. Deploy the Next.js application. In cron-job.org, schedule `GET https://YOUR_APP_HOST/api/cron/sheets` using `0 * * * *`. Set the custom header `Authorization` to `Bearer <CRON_SECRET>` using the same secret configured in Vercel. A `202 Accepted` response confirms the trigger was accepted. Check Controller → Configuration for the sync result. Next.js runs the sync after responding, within the function's 300-second limit. Vercel Fluid Compute is enabled in `vercel.json`.
4. Open Controller → Configuration, select a project/month, paste the Google Sheets URL, and enter the exact tab title. Save verifies spreadsheet access and tab existence. Use Sync now for the first import; inspect status/errors before enabling unattended use.
5. In Projects, choose a configured monthly sheet view to see its current columns. All-record view retains the existing project's columns. Column metadata refreshes every 30 seconds; saved records stream through Supabase Realtime. Database Realtime publication and RLS changes are required for that stream.

## Data ownership and outbound review

- Active Service Delivery uses `assurance_tickets.work_date`; the stored project code is `SERVICE_ASSURANCE` because of the existing display-name swap. Active Service Assurance uses `service_assurance_rows.raw_values.date`, the controller's column A Date; its project code is `SERVICE_DELIVERY`.
- Controller data and technician response tables stay separate. Existing save services retain their validations, assignment rules, version checks and audit logging. A project without an existing workflow adapter reports an explicit error rather than receiving an invented data model.
- Google changes win cell conflicts. AOLMS-only changes remain in the database and become proposals. Conflicting local values are also preserved as proposals before Google values are applied.
- Existing AOLMS records update matching controller Sheet cells automatically at sync. A cell is written only if the current Sheet value still matches the saved base. The Sheets API read and write are separate, so simultaneous edits between them cannot be ruled out. New records still append with stable IDs.
- Proposal rows include stable entry/proposal IDs, configuration and record IDs, field keys, base values, and proposed values. Retrying an interrupted append checks entry IDs before appending. Review-tab cells use RAW input, so text beginning with `=` is not executed as a formula.

## Identifiers and schema

The first sync adds a hidden warning-protected `__aolms_record_id` column and developer metadata for controller column identities. These are integration identifiers, not user-created data columns. Do not modify them. Sort entire records including the hidden identifier column; sorting only a subset of a record's cells changes the meaning of the record and cannot be reconstructed reliably by any row-mapping system.

Initial matching requires a unique ticket number and normalized controller Date; ambiguous matches fail for review. Initial ID writes are read back and verified before operational imports. Later matching uses record UUIDs, never row positions. Removing an established identifier column fails closed. A `review_required` error needs the sheet identifiers inspected and corrected before retrying; do not blindly clear it.

Column metadata preserves identity through renaming/reordering. New custom columns use metadata keys stored in existing JSON values, not new physical database columns. Deleted columns are hidden in monthly views while historical JSON values remain. Removing required business fields can prevent new records from passing existing validation; those rules are not silently relaxed. New imports need a valid controller Date; a synchronized row moved across monthly boundaries pauses for configuration/date review rather than being silently reassigned.

## Incremental jobs and recovery

Each run checks the Drive file version. Unchanged spreadsheet versions skip reading controller cells; local monthly records are still checked for proposals. A changed spreadsheet is read once and compared by record snapshots: unchanged rows are not saved again. Google does not provide dependable row-level revisions, so a changed spreadsheet may require reading its tab, but it never triggers an unconditional rewrite of historical records. Identifier/proposal writes can cause one extra read on the following run.

Spreadsheet advisory locks coordinate overlapping jobs; configuration locks serialize edits/removal with sync. Each changed operational row and its snapshot are committed together, using savepoints in the existing save services. Partial failures keep completed rows idempotent and log the failure. Missing sheet records are marked absent in synchronization metadata; operational records and technician submissions are never deleted. Configuration removal archives the configuration and preserves its snapshots, proposals and logs.

Autosave is independent of hourly sync. Edits debounce for approximately two seconds, with local storage holding only unsaved rows/text. Failed saves retain edits and expose retry/review controls; successful persistence reconciles the cache. Supabase Realtime updates clean rows in place and retains pending local edits for review on conflicts. Events arriving during an in-flight save are queued and replayed afterward.

Inspect `sheet_sync_logs` and Configuration's latest error for troubleshooting. Live Google integration, live migration application, and multi-user RLS/publication verification must be checked in the deployment environment before production activation. No live database or Google writes were performed during implementation.

## Targeted checks

- `node node_modules/vitest/vitest.mjs run lib/services/google-sheets lib/db-nested.spec.ts lib/services/service-delivery/service.spec.ts`
- With a local dev server: `SPREADSHEET_TEST_URL=http://127.0.0.1:3187 node tests/browser/sheets-autosave.browser.mjs` (set the environment variable using your shell's syntax). The browser harness mocks authentication/API calls and performs no live operational writes.

## Google Account sign-in

1. In Google Cloud, enable Google Sheets API and Google Drive API. Configure the OAuth consent screen and create an OAuth client of type **Web application**. If the consent screen is in Testing, add the account you plan to connect as a test user. Testing-mode refresh tokens can expire; use the appropriate production consent setup for unattended long-term synchronization.
2. Register the exact callback URI: `https://YOUR_APP_HOST/api/google-account/callback`. For local development, register `http://localhost:3000/api/google-account/callback` separately. The callback origin must match the AOLMS site you open in your browser.
3. Configure server-only environment variables:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI` (the exact registered callback)
   - `GOOGLE_OAUTH_ENCRYPTION_KEY` (base64-encoded random 32-byte key)
   Generate the encryption key once with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`, store it in your hosting secret settings, and keep it stable across deployments. Do not commit it or expose it through a `NEXT_PUBLIC_` variable. Changing the key requires reconnecting the account.
4. Apply `20261101_google_oauth.sql`, restart/redeploy, and open **Controller → Configuration → Google Account** (the last tab). Click **Connect Google account**, select your account, and approve Sheets and Drive metadata access. Google tokens are encrypted in server-only database tables, never returned to the frontend or stored in browser storage.
5. One connected Google account is shared by all projects/months. It must have Editor access to their spreadsheets. Hourly jobs obtain or refresh access tokens on the backend even while the browser is closed. This connection is independent of AOLMS/Supabase login; connecting or removing Google does not sign you in or out of AOLMS.
6. **Remove account** is available to the connector and administrators. It attempts Google grant revocation, deletes local access/refresh tokens, invalidates pending sign-ins, and leaves a disconnected marker that prevents silent fallback to legacy service-account credentials. Configurations, operational records, technician responses, logs, and proposals are retained. If Google cannot confirm revocation, the UI tells you to remove AOLMS access from your Google Account permissions manually. A request already sent to Google cannot be undone by disconnecting; subsequent requests and jobs stop obtaining credentials.
7. After removal you can connect the same account or a different one. Remove the current account first; connecting never silently replaces someone else's grant. If authorization expires or is revoked in Google, remove and reconnect from this tab. Account setup requires the initial Google Cloud OAuth client; user authorization itself is performed entirely through the tab.

OAuth implementation reference: https://developers.google.com/identity/protocols/oauth2/web-server
