// Apply the repeatable display-name migration to the configured database
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local'), quiet: true });
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL_CA
    ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
});
(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await db.connect();
  await db.query(fs.readFileSync(path.join(__dirname, '../../database/migrations/20260928_swap_service_project_names.sql'), 'utf8'));
  console.log((await db.query("SELECT code, name FROM projects WHERE code IN ('SERVICE_ASSURANCE', 'SERVICE_DELIVERY') ORDER BY display_order, name")).rows);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
