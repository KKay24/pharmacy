# MediQuick Test Plan

## 1. Purpose and status

This plan identifies the test commands and regression coverage currently present in the repository and describes expected verification for future changes. It is documentation, not evidence that every scenario below has already been automated or passed in a particular environment.

## 2. Existing automated tests

| Project | Existing coverage | Command |
|---|---|---|
| Backend | API integration tests and production configuration/security guard tests using Node's built-in test runner | `cd pharmacy-backend/server && npm test` |
| Web | IndexedDB utility, offline sync engine and sync-status indicator tests using Create React App/Jest | `cd pharmacy-inventory && CI=true npm test -- --watchAll=false` |
| Mobile | No test script or test files were found; TypeScript typecheck is available | `cd pharmacy-mobile && npm run typecheck` |

The backend `npm run build` script checks syntax for `src/main.js` and `src/app.module.js`; it does not compile or typecheck the entire backend. The web production build is `npm run build`.

## 3. Test setup and safety

- Run backend integration tests with test/local SQLite configuration; tests create temporary database paths and use test-only credentials.
- Never point tests, fixtures or destructive migration checks at production.
- Keep test passwords/tokens isolated to test code and avoid copying actual customer, patient or staff data.
- Test migration changes against a disposable PostgreSQL database as well as supported local SQLite use where applicable. Verify dialect-specific behavior rather than assuming parity.
- Use controlled product/batch/sale records and clean up only test-owned data.
- Do not treat a passing syntax check or UI snapshot as proof of transaction safety or authorization.

## 4. Current test coverage areas

Backend automated coverage includes:

- Production configuration requires `DATABASE_URL` and `JWT_SECRET`.
- Production rejects SQLite and non-PostgreSQL database URLs.
- Development supports an explicitly configured SQLite path.
- Login returns a bearer token; password change and login behavior.
- Removed debug/seed routes are not exposed.
- Admin creation is restricted to the controlled seed process.
- Authenticated inventory fetch, batch receiving and sale creation.
- Hierarchical taxonomy retrieval, allowed-form scoping, product creation with classification, ID/name inventory filtering and rejection of mismatched form/subcategory filters.

Web automated coverage includes:

- IndexedDB operations and offline data behavior.
- Sync queue reconciliation/status behavior.
- Sync status indicator rendering and user-visible states.
- Dependent stock-entry category/subcategory/form selectors and inventory taxonomy, generic-name and brand filters.

The inventory of test files may change; inspect the package before relying on this list.

## 5. Change-based regression matrix

| Change area | Minimum verification |
|---|---|
| API routes | Authenticated/unauthenticated access, role/permission boundary, valid/invalid input, response/error shape, database effect and web/mobile caller compatibility. |
| Models/migrations | Migration on a disposable database, idempotent rerun behavior where intended, relationship/constraint checks, index checks and preservation of existing data. |
| Authentication | Valid/invalid credentials, expired/invalid token, suspended account, forced password change, password hashing and prohibited role changes. |
| Inventory/products | Product identity match/ambiguity, unique product/batch behavior, receiving, stock aggregate, low-stock thresholds and movement records. Validate main category requirement, subcategory/form parentage, dependent selector resets, generic/brand/supplier filters and safe legacy-data migration. |
| Batches/expiry | Expiry date persistence and display, quantity across multiple batches, ordering used by sales, analytics warnings and retained references. Do not assume expiry-sale blocking unless code/tests implement it. |
| Sales/POS | Cart payload, quantity/total validation, insufficient stock, batch deduction, movement creation, customer association, payment label and sale/movement transaction atomicity. |
| Offline PWA/sync | Data available from cache, enqueue and persistence across reload, online retry, duplicate idempotency, permission failures, server stock conflicts, failed-operation visibility and queue removal only after success. |
| Customers/prescriptions | Customer required/optional fields, list/search/detail/create, customer associations, prescription create/list/status validation and sensitive data handling. |
| Reports/analytics | Empty and representative datasets, time windows, monthly totals, COGS/expenses, forecast input, stockout/expiry results, pagination and no sensitive-field leakage. |
| UI components/pages | Loading/error/empty states, keyboard/accessible interactions where established, API failure messaging and role-based display. |
| Mobile client | API URL resolution, SecureStore session behavior, login redirect, inventory loading/search and category → subcategory → form filters, online POS success/error and `npm run typecheck`. |
| Deployment/configuration | Production config checks, build output, CORS/proxy path, `/health`, PostgreSQL connectivity, migration rollout and client-to-backend connectivity. |

## 6. Manual acceptance scenarios

### Authentication and roles

1. Log in using an active test account and verify the current user/session.
2. Reject invalid credentials and inactive/suspended users.
3. Verify a user requiring a password change can change it and is blocked from other protected operations until then.
4. Verify API requests without valid bearer tokens return unauthorized.
5. Verify `user`, `manager` and `admin` permissions at the API, not only in the web navigation.

### Receiving, inventory and expiry

1. Choose a main category, verify the subcategory list is scoped to it, and verify product forms are scoped to the selected subcategory (for example, Baby Products must not offer medicine injections).
2. Create a product with a main category and optional subcategory/form, then receive a batch with a unique batch number, positive quantity, prices and expiry date.
3. Confirm product/batch listing, classification labels and movement history.
4. Filter by main category → subcategory → form, generic name, brand, supplier, stock status and expiry status; verify changing a parent clears dependent selections.
5. Receive another batch for that product and verify aggregate quantity and low-stock calculations.
6. Attempt mismatched category/subcategory/form IDs and duplicate product/batch inputs; confirm validation/conflict behavior without duplicate or lost stock.
7. Confirm expiry-risk analytics on controlled near-expiry stock; do not interpret that as proof of sale blocking.

### POS and server synchronization

1. Record a sale with available stock and verify sale, batch deduction, movement and aggregate quantity.
2. Attempt invalid quantity and insufficient stock and confirm no partial sale/stock mutation.
3. Repeat an offline operation with the same client transaction ID and confirm it is not duplicated.
4. For the web PWA, disconnect, record a supported queued operation, reload, reconnect and observe the synced/conflict/failed status.
5. Verify server-side stock wins after a sync conflict and no failed/conflicted operation disappears silently.
6. Confirm mobile checkout works online; do not assume mobile offline sync.

### Customers, prescriptions and reporting

1. Create/search a customer and confirm the optional sales/prescription associations.
2. Create a prescription record, list it and update its status.
3. Verify reports from controlled sales/expense rows, including empty months and date boundaries.
4. Verify client-side daily shortage data persists only in browser local storage and is not represented as a server backup/report record.

## 7. Commands

### Backend

```bash
cd pharmacy-backend/server
npm test
npm run build
```

### Web

```bash
cd pharmacy-inventory
CI=true npm test -- --watchAll=false
npm run build
```

### Mobile

```bash
cd pharmacy-mobile
npm run typecheck
```

Install/restore dependencies only when a manifest changed or a validation command reports missing packages. Follow package-local instructions and keep generated build output out of documentation changes.

## 8. Release evidence

For a release, record the commit/revision, environment (without secret values), test commands/results, migration version, deployment target, health-check result and any known limitations. Do not put real database URLs, JWT secrets, admin credentials or patient data in the record.

## 9. Coverage gaps

- Mobile automated tests are not currently verified.
- No API schema/contract test suite or checked-in OpenAPI definition was found.
- Test coverage for complete prescription fulfillment, comprehensive role matrices, PostgreSQL migration upgrades and the full offline conflict matrix is not currently documented/verified.
- Formal load, accessibility, backup-restore, security penetration and disaster-recovery test evidence is not currently documented/verified.
