# Data Sync Debugging and Prevention Guide

This guide documents the data sync flow and the guardrails needed to avoid
silent data loss when the page reloads or when API Gateway rewrites paths.
It is intentionally ASCII-only to avoid encoding issues in toolchains.

## Scope
- Frontend sync logic: `frontend/src/App.js`
- Backend sync endpoints: `backend/server.js`
- Data types: `history`, `painLogs`, `weights`, `achievements`, `readinessLogs`

## Contract (frontend <-> backend)
- GET `/data/sync?t=...`
  - Returns data payloads + `meta` for each type.
  - Uses a cache-busting query string (`t=...`) to avoid stale responses.
- POST `/data/:type?type=...`
  - Always include `type` in query, even if the path already includes it.
  - Response includes `savedAt`, `checksum`, and `itemCount`.

## Why this guardrail exists
Some API Gateways can rewrite `/data/:type` to `/data/{type}`. If the backend
only trusts the path segment, it can save data under the literal `{type}`
key. On reload, `/data/sync` returns empty arrays even though POSTs reported
success.

The backend now resolves the type from:
1) `req.params.type`
2) `req.query.type`
3) `x-original-uri`, `x-original-url`, `x-forwarded-uri`, `x-rewrite-url`,
   `x-envoy-original-path`
4) `req.originalUrl`, `req.url`, `req.path`

If no valid type can be derived, the request is rejected with `invalid_type`.

## Prevention checklist (code changes)
- Always append `type` to POST calls (frontend).
  - Example: `/data/history?type=history`
- Keep the DATA_TYPES list in sync across frontend and backend.
- Normalize data on read in both layers (defensive defaults).
- Add tests for any new sync behavior:
  - Backend: type resolution + write verification.
  - Frontend: sync path + snapshot behavior.

## Quick debug checklist (when data seems to disappear)
1) Browser DevTools:
   - Confirm POST `/data/*` includes `type=...` query.
   - Confirm GET `/data/sync` returns non-empty arrays after writing.
2) Backend logs:
   - Look for `[DATA] Saving type="..."` lines.
   - Check for `write_mismatch` or `invalid_type`.
3) GET `/data/debug`:
   - Verify row counts and stored types for the user.
4) Local snapshot:
   - Inspect `localStorage.mfr_last_sync` in the browser.
5) Meta checks:
   - `meta.<type>.lastUpdatedAt` should move forward after POST.

## Known failure modes and signatures
- Path placeholder saved:
  - Symptom: POST succeeds but GET returns empty arrays.
  - Backend logs show `type="{type}"` or `invalid_type`.
- Cache returns stale sync:
  - Symptom: GET returns 304 or old payload.
  - Fix: ensure `cache: 'no-store'` and cache-busting `t=...`.
- Missing auth token:
  - Symptom: 401 on sync or save.
  - Fix: verify `Authorization: Bearer <token>`.

## How to add a new data type safely
1) Add the type to frontend `DATA_TYPES` and normalize helpers.
2) Add the type to backend `DATA_TYPES` and normalize helpers.
3) Add backend tests for read/write and meta.
4) Add frontend tests for sync and local snapshot behavior.

## Useful endpoints
- `GET /data/sync` (requires auth)
- `GET /data/debug` (requires auth)
- `POST /data/:type` (requires auth, always include `type=...`)

## Example curl snippets
```bash
# Sync
curl -H "Authorization: Bearer $TOKEN" \
  "https://<api-gateway>/data/sync?t=$(date +%s)"

# Save readiness logs
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://<api-gateway>/data/readinessLogs?type=readinessLogs" \
  -d '{"data":"example"}'
```
