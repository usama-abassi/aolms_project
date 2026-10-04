# Controller Inventory

`/controller/inventory` lists all projects in their saved order. Service Delivery is implemented; other project panels are blank. The existing name-swap migration maps Service Delivery to the stable `SERVICE_ASSURANCE` code.

Apply `database/migrations/20261002_material_inventory.sql` before using the page on another environment. It adds two RLS-protected backend-only tables and seeds the 53 material definitions from September's Dashboard 2026. July has the same first 43 materials. Historical stock quantities are not imported. Item codes, including separate codes with identical names, are preserved. Missing units and September's FTTR mapping notes are represented as unspecified units, not invented units.

Record opening stock once as a material's first entry, then add dated receipts. Faulty entries subtract stock and cannot make the balance negative on that or a subsequent date. Opening balances carry forward, including through months with no entries. Remaining = opening + received − used − faulty. Units are kept per material and never summed together.

Controllers and admins use authenticated GET/POST `/api/material-inventory/:projectId`. Entries preserve their actor and reference. Repeating the same stock-entry mutation ID is idempotent; writes lock the material to serialize balance checks. History shows the selected month's latest 100 entries. Entries are append-only in this first version.

Service Delivery usage integration remains deferred. The schema and monthly summary support `used`, but the API rejects manual usage. Future integration must lock the material, prevent negative stock and use a unique source/mutation key so submission retries and edits cannot deduct twice.
