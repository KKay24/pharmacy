# PWA and Offline Operations

## Production topology

The React 19 client is deployed to Vercel. Its `/api/*` requests are proxied to the canonical NestJS backend on Render, which uses PostgreSQL as the permanent source of truth. IndexedDB is a browser cache and a durable queue only; deleting it must never be treated as data recovery.

## PWA behavior

`public/manifest.json` defines the MediQuick name, icons, standalone display mode, theme, and scope. `public/service-worker.js` caches the application shell and static assets, uses network-first navigation fallback, and never caches API responses. `vercel.json` marks the service worker as revalidating so deployments can update without a stale worker blocking new bundles.

## IndexedDB stores

The `mediquick_pharmacy_db` database is owned by `src/utils/offlineDb.js`:

- `products`: last synchronized inventory and batches
- `customers`: last synchronized customers
- `recentSales`: recent server sales plus local receipts and their sync status
- `pendingOperations`: FIFO offline `SALE`, `RESTOCK`, and `ADJUSTMENT` operations
- `syncMetadata`: last successful sync and cached dashboard data

No credentials, secrets, or database connection data are stored in IndexedDB. Authentication continues to use the existing session storage and bearer-token flow; offline access is limited to a previously authenticated browser session.

## Offline sales and synchronization

A sale receives a random `clientTransactionId`, is written to `recentSales`, immediately updates the local inventory view, and is placed in `pendingOperations` with `pending` status. The queue survives refresh and browser restarts. `SyncEngine` retries failed operations when connectivity returns and removes an operation only after `/api/sync` confirms `synced` or `already_synced`.

The backend requires the client transaction ID, checks the authenticated role, validates current PostgreSQL stock under row locks, and executes the sale and stock movements in a database transaction. `Sales.clientTransactionId` has a unique index. Replaying the same operation returns the existing sale instead of creating another one. Inventory movements remain traceable by transaction ID.

A server-side stock shortage, missing product, or other reconciliation issue remains in IndexedDB as `conflict` or `failed`. It is visible in the sync indicator and is not silently discarded. The server is authoritative for the final stock quantity; local optimistic quantities are refreshed after synchronization.

## Environment and deployment

Frontend local development:

```bash
REACT_APP_API_BASE_URL=http://localhost:5001
```

Vercel production should leave `REACT_APP_API_BASE_URL` unset and set:

```bash
BACKEND_API_URL=https://your-render-service.onrender.com
```

Render must retain the existing PostgreSQL and authentication configuration, including `DATABASE_URL`, `JWT_SECRET`, and the exact production Vercel origin in `FRONTEND_URL`. Run `npm run migrate` through the existing Render build command; migrations are additive and do not reset production data.

## Backup and recovery

Use Render PostgreSQL automated backups and a separate retention policy suitable for the pharmacy. For an operator-managed export, use `pg_dump` against the Render `DATABASE_URL` and encrypt the resulting file outside the repository:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="pharmacy-$(date +%Y%m%d).dump"
pg_restore --clean --if-exists --dbname="$DATABASE_URL" "pharmacy-YYYYMMDD.dump"
```

Test restores into a non-production database. Browser cache, service-worker cache, and IndexedDB are not backups and cannot recover PostgreSQL data after device or browser loss.

## Offline test checklist

1. Log in online and load inventory, customers, and recent sales.
2. Disable the network and reload the installed PWA.
3. Record a sale and verify `Saved locally`/pending status remains after refresh and browser restart.
4. Restore the network and verify `Syncing...`, then `Synced`.
5. Confirm the sale and stock movement in PostgreSQL.
6. Replay the same transaction ID and confirm no duplicate sale.
7. Test failed API requests, insufficient stock, and concurrent inventory changes; each must remain queued with a visible failed/conflict state.
8. Run `npm run build` in `pharmacy-inventory` and `npm test` in `pharmacy-backend/server` before deployment.

## Troubleshooting

- `Offline`: check browser connectivity and the Render `/health` endpoint; cached data remains usable.
- `Sync failed`: open the status indicator, inspect the failed count, restore backend/auth connectivity, and use `Sync Now`.
- `Conflict`: refresh inventory, resolve the server-side stock discrepancy, then retry the operation according to pharmacy procedure.
- No install prompt: use HTTPS, verify the manifest icons and service worker are reachable, and check that the browser supports PWA installation.
