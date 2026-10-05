# AI Agent Instructions

## Project Overview

MediQuick is a three-part pharmacy operations workspace:

- `pharmacy-backend/server` is the canonical API and persistence layer.
- `pharmacy-inventory` is the React web client/PWA.
- `pharmacy-mobile` is the Expo/React Native client with a smaller online feature set.

The backend is the source of truth for persisted data. Production requires PostgreSQL; SQLite is for local development/tests. The web PWA has selected local caches and an offline operation queue. The mobile app is not verified to have equivalent offline behavior.

Read the [README](README.md), [architecture](docs/architecture-diagram.md), [database ERD](docs/database-erd.md), [deployment guide](docs/deployment.md), [design document](docs/software-design-document.md) and [test plan](docs/test-plan.md) when they are relevant. Documentation describes the current repository and must be revised when implementation materially changes.

## Repository Structure

```text
pharmacy-backend/server/
  src/                 Nest-style controllers/services, guards, validation, sync and analytics
  models/              Sequelize models and associations
  migrations/          Versioned schema/data migrations
  tests/               Node test-runner API/config tests
  scripts/             Migration, seed, audit and operations utilities
  config/              Database initialization

pharmacy-inventory/
  src/pages/           React route pages
  src/components/      Shared UI, POS, stock, PWA and sync components
  src/context/         Shared React application data/auth context
  src/utils/           API client, local IndexedDB and sync utilities
  public/              PWA manifest, service worker and static files
  api/                 Vercel proxy function to the canonical backend
  server/              Legacy backend; not the source of truth for new API work

pharmacy-mobile/
  app/                 Expo Router login and tab routes
  api/                 Axios client and bearer-token setup
  context/             Mobile auth/session state
  utils/               Mobile inventory helpers

docs/                  Root project architecture, design, deployment and test docs
```

## Architecture Rules

- Add backend API work in `pharmacy-backend/server/src`; do not extend the legacy `pharmacy-inventory/server` as if it were canonical.
- The web and mobile clients call the canonical API. Production web `/api/*` traffic is routed by Vercel to `pharmacy-inventory/api/index.js`, which forwards it to the configured backend.
- Keep database access in the backend through Sequelize models/services and the versioned migrations. Clients must not connect directly to PostgreSQL.
- Treat PostgreSQL as production persistence. Web IndexedDB/local storage is a client cache, UI preference/report state or sync queue—not a source of truth or recovery mechanism.
- Keep client capabilities explicit: the web PWA has offline queue/reconciliation code; the mobile client is currently a narrower online client.
- External service/config integrations must be confirmed in source before being represented as active behavior. A dependency or config file alone does not prove a runtime integration.

## Coding Rules

- Follow the existing architecture and module boundaries; reuse current components, API clients, services and helpers.
- Avoid unnecessary dependencies and broad refactors.
- Keep TypeScript strongly typed where TypeScript is used (currently especially the mobile app); do not introduce `any` or unsafe casts where a proper type/guard is feasible. Preserve established JavaScript patterns in JavaScript modules.
- Do not duplicate business rules between clients and the API. The server owns authoritative validation, authorization, stock updates, idempotency and persisted reporting inputs.
- Keep API contracts consistent with existing callers. When changing a route, request shape, response or status behavior, inspect and update all relevant clients and tests.
- Follow existing naming conventions: API route families use `/api/<resource>`, and models/services/controllers are grouped by resource.
- Prefer small, focused changes. Do not change unrelated code or behavior.
- Validate external/user-provided inputs at the service/API boundary, return repository-standard errors, and avoid hiding failures behind success-shaped fallbacks.

## Database Rules

- Understand model associations, foreign keys, unique indexes, nullability and migration history before changing schema or data behavior.
- Use a new migration under `pharmacy-backend/server/migrations`; do not rely on implicit `sync()` or manual production schema edits.
- Never destroy production data. Do not write a migration that drops/recreates operational tables or silently discards ambiguous inventory records.
- PostgreSQL is the production database. Do not introduce SQLite-specific behavior or assumptions into production paths; SQLite is used for local/test configurations.
- Preserve existing indexes and constraints, including product identity, batch uniqueness and offline idempotency indexes.
- Keep inventory quantities and batch records consistent; stock changes must follow existing transaction and movement-history behavior.
- Never commit database URLs, usernames/passwords, dumps containing real data, or other credentials.
- Do not add ORM associations or infer foreign keys based only on matching field names; document only relationships present in models/migrations.

## Authentication and Security Rules

- Never hard-code, print, commit or place secrets in docs, fixtures, logs, screenshots or tests. Never commit `.env`.
- Do not weaken authentication, CORS controls, token verification, active-account checks, password-change enforcement or authorization guards.
- Do not bypass API authorization because the UI has a protected route. Preserve role and permission checks at the API.
- Validate and normalize user input; do not trust client role claims, prices, quantities, IDs or local cached state.
- Keep sensitive customer/health information out of logs and test fixtures unless anonymized and strictly required.
- Do not expose password hashes, tokens, credentials, private configuration or internal database errors through API responses.
- Use placeholders such as `<DATABASE_URL>` and `<JWT_SECRET>` in examples.

## API Rules

- Keep canonical API routes under `/api`. Preserve the current route and HTTP method unless there is a coordinated contract change.
- Public exceptions currently include `POST /api/auth/login` and `GET /health`; protected endpoints use bearer authentication, with resource-specific roles/permissions.
- Preserve service-level validation and Nest/Express error behavior. Not all endpoints use one identical error or success envelope; do not standardize responses without checking every caller.
- List endpoints using the shared pagination helper accept `page` and `limit` (defaults: page 1/25 rows, maximum 100) and return `{ data, pagination }`. Do not assume all routes are paginated.
- Preserve the established batch, sale and sync payload shapes and `clientTransactionId` idempotency behavior. Update web/mobile callers and tests together when a contract changes.
- Do not claim an endpoint is authenticated, role-restricted, paginated or permission-gated from UI behavior alone; verify its controller guards and service.

## Testing Rules

Add/update tests when changing:

- **API endpoints:** cover authenticated and unauthenticated access, valid/invalid payloads, response contract, relevant permission boundaries and persistence effects.
- **Database entities/migrations:** cover migration behavior against supported dialects where practical, constraints/relationships, upgrade safety and preservation of existing data.
- **Authentication:** cover login, token validation/expiry, inactive users, password change and role/permission enforcement.
- **Inventory:** cover batch quantities, duplicate/product identity behavior, movements, low-stock thresholds, expiry dates and concurrent-safe stock adjustments.
- **Sales:** cover quantity validation, stock insufficiency, batch deduction, totals, customer association, idempotent retries and sale/movement atomicity.
- **Reports:** cover aggregation windows, empty data, dates, totals and sensitive-field exclusion.
- **UI components:** cover user-visible states, loading/error/empty behavior, API contract interactions and offline/conflict behavior where relevant.

Use existing test patterns and runners; do not add test tooling without need. Relevant current commands are recorded in the [test plan](docs/test-plan.md). Mobile has a typecheck command but no package test script.

## Deployment Rules

- Follow checked-in deployment configuration; do not assume a provider or topology from comments or stale docs.
- Current checked-in production topology is a Render backend/PostgreSQL blueprint and Vercel web proxy configuration. Confirm the relevant `render.yaml`, backend configuration, `vercel.json` and proxy before changing deployment docs.
- Root Dockerfile and `pharmacy-inventory/docker-compose.yml` are also present. Treat them as alternative checked-in configs unless they are verified against the intended deployment target.
- Production backend startup requires PostgreSQL `DATABASE_URL` and `JWT_SECRET`; SQLite must not be used in production.
- Keep provider credentials in deployment secret storage and CORS origins limited to the intended frontends.
- Mobile distribution, signing and release configuration is not currently documented/verified; do not invent it.

## Before Making Changes

1. Inspect the relevant implementation files and identify the canonical path.
2. Understand the existing behavior, API/data relationships and callers before editing.
3. Check related tests and existing patterns.
4. Make the smallest appropriate change that completely addresses the request.
5. Run the relevant tests and available lint/build/type checks.
6. Review the full diff for unintended changes, secrets and generated files.

## Documentation Rules

- Update relevant docs whenever a significant architecture, database, API, deployment or workflow change is introduced.
- Keep terminology consistent: **medicine/product**, **batch**, **stock movement**, **sale**, **customer**, **prescription**, **web PWA**, **mobile client**, and **canonical API**.
- Distinguish implemented, partially implemented, and planned functionality. Only call an item planned when an authoritative repository or product requirement confirms that plan; otherwise say “Not currently documented/verified.”
- Do not copy live credentials, personally identifiable information or patient data into documentation.
- Keep links relative and verify that new/changed links resolve within the repository.
