# Service Delivery grid — Phase 1

The existing controller project page retains its columns, frozen header, pagination, login, metadata and operational record APIs. Editable cells now use plain text. Controller, SLA and KPI remain protected.

## Persistence

Apply `database/migrations/20261002_delivery_grid_drafts.sql` before deploying this change to another environment. It adds an RLS-protected table; it does not modify existing tickets or profiles. GET/POST `/api/assurance-tickets/grid` require an active controller or admin.

Committed edits immediately enter a per-row request queue. Drafts preserve all typed strings, including spaces, line breaks, leading zeros and original date formats. Valid drafts promote through the existing ticket validation, assignment, version and audit logic in the same transaction. Invalid drafts remain database-backed drafts; the last valid official record remains available to technicians and reports. The grid's red corner notes explain unmatched or missing values. Automatic KPI values are preserved, not recalculated by this change.

Record dates recognize YYYY-MM-DD and DD/MM/YYYY. Date-times additionally accept HH:mm[:ss]; an omitted timezone uses Bahrain (+03:00), as before. Date/time keyboard shortcuts use Bahrain. Normalized operational values are separate from exact raw text. Team matches an active technician name or ID; ambiguous names do not promote.

Each controller owns their unpromoted drafts. Other controllers can read the exact text of the current promoted snapshot. Per-row locks, draft versions, official record versions and mutation IDs protect against stale writes and lost-response retries. Inline conflict review allows comparing current official data before explicitly applying a retained draft. The previous batch endpoint remains unchanged for existing integrations.

Browser storage backs up pending requests and uncommitted editing text. Failed requests retry on connection recovery and every ten seconds. Storage errors are shown inline. A row with a pending request is never labelled saved. Uncommitted text from a previous visit can be restored explicitly. Cross-tab changes do not silently overwrite another tab's local backup.

## Phase 1 keyboard behavior

- Selected cell: typing replaces its contents; F2 or double-click edits at the end.
- Enter / Shift+Enter commit and move down / up. Tab / Shift+Tab commit and move right / left.
- Enter after a sequence of Tabs returns to the sequence's starting column on the next row.
- Esc cancels the current uncommitted edit. Alt+Enter inserts a newline.
- Delete / Backspace clears the selected cell; while editing, normal text deletion applies.
- Ctrl+; inserts the date, Ctrl+Shift+; inserts time, Ctrl+Alt+Shift+; inserts both. Commit with Enter, Tab or leaving the cell.
- Cmd and Option use the corresponding Meta and Alt modifiers.

Multi-cell selection/paste/fill, grid undo/redo, archiving/hiding shortcuts, and find/replace are intentionally deferred to phases 2–4. Phase 1 clearing applies to the single selected cell.

## Verification

The `Phase 1 typing autosave and all shortcuts` browser scenarios exercise both Control and Meta modifiers, delayed saves, exact-text reload, failed-request retry and protected cells. The `Phase 1 grid` database test exercises raw draft storage, promotion, idempotency, concurrent changes, protected identities and SLA, and rolls back its data. Unit tests cover strict date parsing, validation, name matching and authorization.
