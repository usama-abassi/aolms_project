# AOLMS

One full-stack Next.js application. The repository root is the Vercel project root. App Router pages and all `/api` Route Handlers build and deploy together; there is no Express/Nest server, backend port, reverse proxy, or second deployment.

## Local setup

Use Node.js 22 LTS or newer (Vercel: select Node.js 22.x).

```sh
npm install
cp .env.example .env.local
npm run dev
```

PowerShell: `Copy-Item .env.example .env.local`. Fill in your own values before building. This workspace already has a private `.env.local` migrated from the previous configuration; do not overwrite it unless replacing its values.

Open `http://localhost:3000`. All application API requests use relative `/api/...` paths. Supabase authentication and existing browser database calls continue to use Supabase's hosted API with the public key and RLS. Never put service-role or database credentials in a public variable.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
npm run test:browser
npm run test:database
```

Browser tests use Playwright with Microsoft Edge by default; install it on the test machine (or configure a Playwright Chromium browser). They start the production Next server on port 4173, use isolated mocked users/data, and exercise desktop/tablet/mobile views and both themes. `test:database` explicitly uses `.env.local` for read-only checks against your existing database; ordinary unit tests need no database. The health endpoint is `GET /api/health` and returns `{"status":"ok"}` without needing a database connection.

## Vercel environment variables

Set the following for **Production** and any **Preview/Development** environments you use. Public variables must be present at build time; redeploy after changing them.

| Variable | Required | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key (the existing anon key also works) |
| `SUPABASE_SECRET_KEY` | Yes | Supabase secret key or service-role key; server only |
| `DATABASE_URL` | Yes | PostgreSQL pooler connection string; server only; URL-encode special password characters |
| `DATABASE_POOL_MAX` | No | Defaults to `4` connections per warm function instance |
| `DATABASE_SSL_CA` | No | Provider CA certificate if needed; literal `\n` line separators are accepted |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | Defaults to `true`. Set to `false` to use the previous connection behavior without a custom CA; the connection remains encrypted but the server certificate is not verified. A supplied CA always enables verification. |

Use Supabase's transaction pooler for Vercel (normally port 6543), with the exact hostname/username from your project's Connect panel. A shared session pooler also works if configured for your database. The application uses bound, unnamed SQL queries, a small module-level pool, and Vercel's `attachDatabasePool` lifecycle support. Database clients are initialized lazily and shared by requests; transactions always release their connections. `DATABASE_SSL_CA` takes precedence over the verification flag.

`PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `SUPABASE_JWKS_URL`, `VITE_*`, and an external backend URL are no longer required. JWT verification still calls Supabase Auth and checks the authoritative active profile role; roles are never trusted from editable token metadata.

## Deploy to Vercel

1. Push this repository to your Git provider, then import it in Vercel as **one project**.
2. Select **Next.js**. Set **Root Directory** to the repository root (`.`), not a former client/server directory.
3. Set Node.js **22.x**, install command `npm ci`, build command `npm run build`. Leave Output Directory and Start Command at Vercel's framework defaults. No `vercel.json` is needed.
4. Add the four required environment variables above and any TLS/pool settings required by your database. Use an appropriately restricted preview database if preview deployments should not touch production data.
5. Deploy. Vercel hosts pages and `/api` functions under the same domain.
6. In Supabase **Authentication → URL Configuration**, set Site URL to your production HTTPS domain and allow the production login URL and any intentional preview/local redirect URLs. Keep the existing Auth users, profiles, roles, and RLS policies.
7. Verify `/api/health`, then sign in as Admin, Controller, and Technician. Check project ordering, edits, submissions, Audit filters, equipment databases, and Operations Center.

The code has been built and tested locally; publishing to your Vercel account and setting its environment variables remain manual steps.

## Database and cloud setup

This migration reuses your existing Supabase database and Auth project. It does not recreate users or reimport customer records. SQL migrations are retained under `database/migrations/` in date order. Apply only migrations missing from the target database; the current connected database already has the migrations used by this app. There is no automatic schema synchronization during deployment. For a brand-new Supabase project, restore the existing base schema, functions, policies, and data first: these incremental migrations are not a complete base-schema installer.

Keep Supabase RLS enabled for browser-accessible tables. Backend-only staff/history tables remain accessible through authenticated Route Handlers. Profile/account creation keeps its rollback cleanup behavior; Assurance preserves optimistic versions, mutation IDs, transaction locks, assignment rules, and the original 24-hour edit window.

There is no active binary-upload endpoint or local-upload directory. `/api/attachments` continues to read attachment metadata from the database, including existing storage keys. Keep the existing Supabase Storage objects and bucket policies if your data references them. Any future binary uploads should go directly to a private Supabase Storage bucket using authenticated/signed upload URLs; never write them to a Vercel function filesystem. No new bucket is required for current features.

No application SMTP/email-sending integration was found. Admin-created login accounts retain the existing confirmed-account behavior. If Supabase Auth emails are enabled for future recovery/invite flows, configure SMTP and redirect URLs in Supabase, not in browser environment variables.

## Preserved behavior

- Admin user/account management and project display sequence.
- Controller Projects, Assurance/Delivery editing, ONT DB/CPE DB pagination and editing, and database-backed Operations Center.
- Technician To-Do, submissions, local drafts, edit deadlines, and post-submit navigation.
- Audit logic only on Service Delivery; other project tabs stay blank. Clickable counts and filters remain in every stage. Customer-template export remains pending the customer's template, exactly as before migration.
- Light/dark themes, responsive layouts, optional browser-side Excel export, and all existing API methods/paths (dynamic parameter names are normalized internally only).

## Layout and maintenance

- `app/`: native App Router pages, role layouts, and `api/**/route.ts` handlers.
- `components/portal/`: migrated UI/components/features; React Router has been replaced by Next navigation and links.
- `lib/`: server-only authentication, database pool, HTTP handling, explicit-column repositories, validation, and preserved service/business logic.
- `public/`: static assets; `types/`: environment types.
- `database/migrations/`: existing incremental schema/policy migrations.
- `database/import-backups/`: original read-only workbook backups. Runtime pages read PostgreSQL; these files are not needed by deployed functions and are never public assets.
- `scripts/maintenance/`: one-time data extraction/import utilities using root dependencies and `.env.local`. These are manual database administration tools, not another application.
- `tests/`: route/auth/repository tests, browser tests, and opt-in live-database verification.
- `docs/api-route-inventory.json`: pre-migration inventory of all 65 existing endpoint methods, used by compatibility tests.
- `docs/migration-reference/`: retired command-based verification references; current tests replace their old compiled-server dependency.

The SheetJS version already used by this repository is vendored as `vendor/xlsx-0.20.3.tgz` because npm remote-tarball fetching is disabled in the current environment. Its license is included in the package. This preserves spreadsheet export behavior and supports reproducible `npm ci` installations.

Database pool lifecycle follows [Vercel's connection-pooling guidance](https://vercel.com/kb/guide/connection-pooling-with-functions); the API uses [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
