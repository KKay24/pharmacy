# MediQuick Pharmacy Workspace

MediQuick is a pharmacy operations workspace made up of a shared API, a browser-based inventory/POS application, and a smaller Expo mobile client.

## Purpose

The system centralizes pharmacy product and batch inventory, stock movements, point-of-sale transactions, customer and prescription records, staff access, and operational reporting. The web application also supports a limited offline workflow for previously cached data and queued transactions.

## Current implementation status

| Area | Status | What the repository confirms |
|---|---|---|
| Web inventory, batch receiving, POS, customers, expenses, suppliers and staff access | **Implemented** | React routes call the canonical API. |
| Batch quantities, expiry dates and movement history | **Implemented** | Batches are attached to medicines; sales deduct batches in expiry-date order and create movement records. |
| Authentication and role/permission checks | **Implemented** | The API issues bearer tokens and checks active accounts, roles and permissions. |
| Web PWA offline cache and sync queue | **Implemented** | The web client caches selected data in IndexedDB and submits queued sales, restocks and adjustments to `/api/sync`. |
| Prescription records/status workflow | **Partially implemented** | The API stores and lists prescription records and updates status. A complete prescription fulfillment/e-prescribing workflow is not verified. |
| Reports and analytics | **Partially implemented** | The API provides monthly profit/loss, forecast, reorder, stockout and expiry-risk data. Some daily-ledger reporting is calculated in the browser. |
| Mobile application | **Partially implemented** | Expo includes login, searchable inventory with hierarchical category filters, POS checkout and profile tabs. It does not implement the web client's offline queue, and mobile checkout currently uses cash. |
| Product categories, subcategories and forms | **Implemented** | Product classification uses seeded main-category, subcategory and product-form references. New products require a main category; subcategory and form are optional, dependent selections. Legacy values are retained; unrecognized historical products can remain unclassified. |
| Prescription OCR | **Not currently documented/verified** | OCR is present in web stock/invoice capture; a prescription OCR workflow was not confirmed. |
| Approved future roadmap | **Not currently documented/verified** | No authoritative roadmap was found in the repository. |

This status describes repository code and configuration, not production availability or operational certification.

## Features

- Medicine catalog with hierarchical main category, subcategory and product form, generic/brand names, strength, pack size, unit of measure, supplier/manufacturer labels, barcode, reorder threshold and image URL.
- Batch-level stock receiving with quantity, cost/selling prices, supplier reference, warehouse, invoice number, received date and expiry date.
- Inventory movement history and low-stock queries.
- Web POS with customer lookup/association, receipts, payment-method fields and offline queueing in the PWA.
- Customer records, including optional contact and health-related fields.
- Prescription records with patient/prescriber, medication text, due date, optional image path and status.
- Expense and supplier management.
- Monthly profit/loss and sales/inventory risk analytics.
- Administered staff accounts with `admin`, `manager` and `user` roles.
- Expo mobile login, searchable/filterable inventory view and online POS.

## System overview and architecture

The workspace contains three related projects:

1. **Canonical backend API** — `pharmacy-backend/server`, implemented with NestJS controllers/services on Express and Sequelize models.
2. **Web client** — `pharmacy-inventory`, a Create React App/React application with React Router, service-worker/PWA support, IndexedDB local data and a Vercel API proxy.
3. **Mobile client** — `pharmacy-mobile`, a React Native/Expo application using Expo Router and the same backend API.

The API is the source of truth for persisted operational data. Production database configuration requires PostgreSQL. SQLite is available for local development and tests. The web PWA's local data is a cache/queue, not a backup or authoritative ledger. Product classification is stored in the existing `Medicines` catalog using references to the seeded `InventoryCategories` hierarchy; it does not create a parallel product catalog.

The separate `pharmacy-inventory/server` directory is identified in the existing project README as legacy; new API work belongs in `pharmacy-backend/server`.

## Core workflows

### Authentication

Users sign in at `POST /api/auth/login`. The API verifies the password, checks account status and returns a signed bearer token plus a serialized user. Protected requests send `Authorization: Bearer <ACCESS_TOKEN>`. The backend applies route-specific roles and permissions; web route restrictions are an additional UI layer, not a replacement for API authorization. The web client persists session data in browser local storage. The mobile client stores its session/token using Expo SecureStore.

### Inventory, classification and batches

Medicines are catalog records classified by main category, optional subcategory and optional product form. Forms such as Tablet, Syrup, Lotion and Syringe are not main categories. Web stock entry, product editing and inventory filters use the API taxonomy to present dependent selections. Product/batch receiving, expiry dates and stock movements continue to use the existing medicine and batch workflows. The migration keeps legacy category/dosage text and classifies recognized values where a safe mapping is available; unknown historic products remain loadable and may require classification.

### Sales/POS

The POS client submits sale line items to `POST /api/sales`. The API validates stock, deducts it across available batches in ascending expiry-date order, writes sale and movement records transactionally, and stores the selected payment-method label. The mobile POS currently submits online sales with `Cash` as its payment method. The web PWA can queue supported operations while offline for later reconciliation.

### Expiry and reporting

Batch expiry dates are stored at batch level. Analytics include expiry-risk, stockout-risk, dead-stock and reorder outputs. Monthly profit/loss is computed from recorded sales and expenses. The web reports screen also derives a daily ledger from the sales data it has loaded and stores manually entered daily shortages in browser local storage.

## Technology stack

| Layer | Technologies |
|---|---|
| Backend | Node.js, JavaScript, NestJS 12, Express 5, Sequelize 6, PostgreSQL, SQLite for local/test use, Zod dependency |
| Web | React 19, Create React App (`react-scripts`), React Router, Recharts, IndexedDB, service worker, Tesseract.js, PDF.js |
| Mobile | React Native 0.81, Expo SDK 54, Expo Router, TypeScript, Axios, Expo SecureStore |
| Deployment/configuration in repository | Render blueprint, Vercel configuration and API proxy, Dockerfile and Docker Compose configuration |

## Repository structure

```text
.
├── README.md
├── AGENTS.md
├── docs/                         # Project architecture, data, deployment and test documentation
├── pharmacy-backend/
│   └── server/
│       ├── src/                  # API controllers, services, auth, analytics and sync
│       ├── models/               # Sequelize entities and associations
│       ├── migrations/           # Versioned database migrations
│       ├── tests/                # Node test-runner integration/config tests
│       ├── scripts/              # Migration, seed and operational scripts
│       └── config/               # Database configuration
├── pharmacy-inventory/
│   ├── src/                      # React pages, components, context and utilities
│   ├── public/                   # PWA manifest, service worker and static assets
│   ├── api/                      # Vercel serverless proxy to the canonical backend
│   └── server/                   # Legacy API implementation; not canonical
└── pharmacy-mobile/
    ├── app/                      # Expo Router auth and tab screens
    ├── api/                      # Backend API client
    ├── context/                  # Mobile authentication state
    └── utils/                    # Mobile inventory helpers
```

## Local development

Use a supported Node.js version compatible with the package manifests and install dependencies inside each app. The backend and clients are separate npm projects; there is no root package manifest.

### 1. Start the backend

```bash
cd pharmacy-backend/server
npm install
cp .env.example .env
```

Set a local `JWT_SECRET` and, if needed, a local `SQLITE_STORAGE_PATH` in `.env`. Local/test startup uses SQLite when no database URL is configured and applies migrations during application initialization. For an explicit migration run, use `npm run migrate`. The API listens on port `5001` by default.

For the first administrator, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (at least 12 characters) in the backend environment, then run `npm run seed`. The seed script does not provide default credentials and refuses to create another administrator when one already exists.

```bash
npm start
```

### 2. Start the web client

In another terminal:

```bash
cd pharmacy-inventory
npm install
cp .env.example .env
```

For local API access set `REACT_APP_API_BASE_URL=http://localhost:5001`, then run:

```bash
npm start
```

Create React App serves the web client at `http://localhost:3000`. In production, Vercel's `/api/*` rewrite forwards requests through `api/index.js`; `BACKEND_API_URL` is the proxy's backend destination.

### 3. Start the mobile client (optional)

```bash
cd pharmacy-mobile
npm install
cp .env.example .env
npm start
```

Outside development, set `EXPO_PUBLIC_API_URL` to the backend base URL. In development the API client attempts to derive a reachable backend address from Expo's host/device configuration; verify connectivity from the target simulator or device.

## Environment variables

Set variables in the relevant app's local `.env` file or deployment secret store. Do not commit `.env` files or real credentials.

| Variable | Project | Purpose |
|---|---|---|
| `PORT` | Backend | HTTP listening port; defaults to `5001`. |
| `NODE_ENV` | Backend | Runtime mode; production requires PostgreSQL and `JWT_SECRET`. |
| `JWT_SECRET` | Backend | Signing/verification secret for API access tokens; use a strong secret supplied by the deployment platform. |
| `JWT_EXPIRES_IN_HOURS` | Backend | Access-token lifetime in hours; defaults to `12`. |
| `DATABASE_URL` | Backend | PostgreSQL connection URL; required for production. Use `<DATABASE_URL>` in examples, never the real value. |
| `POSTGRES_URL` | Backend | Alternate database URL recognized by the connection setup; production startup specifically requires `DATABASE_URL`. |
| `SQLITE_STORAGE_PATH` | Backend | Optional SQLite file path for local/test use; SQLite is rejected in production. |
| `ENABLE_DEMO_SEEDING` | Backend | Enables development demo seeding only outside production. |
| `ALLOW_LEGACY_DEV_AUTH` | Backend | Optional legacy username-header authentication toggle; disabled in production. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Backend | Inputs for the controlled `npm run seed` operation. |
| `FRONTEND_URL`, `FRONTEND_URLS` | Backend | Allowed browser origins for production CORS. |
| `ALLOW_VERCEL_PREVIEWS` | Backend | Controls whether HTTPS `*.vercel.app` preview origins are allowed. |
| `REACT_APP_API_BASE_URL` | Web | Optional API base URL; local default resolves to `http://localhost:5001`, production can use the same-origin proxy. |
| `BACKEND_API_URL` | Web/Vercel | Destination backend base URL for the Vercel API proxy. |
| `EXPO_PUBLIC_API_URL` | Mobile | Backend base URL required by the mobile app outside development. |

The repository contains environment examples in each application directory; review those before configuring an environment. Values shown there are examples/defaults, not secrets.

## Database setup

The backend defines Sequelize models and versioned migrations. Production must use PostgreSQL through `DATABASE_URL`; SQLite is intended for development and tests only. Production deployment runs `npm run migrate` as part of the checked-in Render build command. Local non-production API initialization also invokes migrations.

Key entities are `Users`, `Medicines`, `Batches`, `InventoryMovements`, `Sales`, `Customers`, `Prescriptions`, `Suppliers`, `Expenses` and `AuditLogs`. See [Database ERD](docs/database-erd.md) for the confirmed relationships.

## Running and checking the project

From `pharmacy-backend/server`:

```bash
npm start
npm test
npm run build
```

`npm run build` performs Node syntax checks on the main entry and app module; it is not a transpilation/build step.

From `pharmacy-inventory`:

```bash
npm start
npm test
npm run build
```

The web tests use Create React App/Jest. Use `CI=true npm test -- --watchAll=false` for a non-interactive run.

From `pharmacy-mobile`:

```bash
npm start
npm run typecheck
```

The mobile package currently has a TypeScript typecheck script but no test script.

## API overview

The canonical API is rooted at `/api`; all routes except login and health require authentication unless noted in [Architecture](docs/architecture-diagram.md). Main route families include:

- `/api/auth` — login, current user, password change and admin user management.
- `/api/inventory` — medicines, batch receiving, low stock and per-medicine movements.
- `/api/inventory/categories` — authenticated hierarchical product-category reference data. Inventory list filters accept `category`/`mainCategoryId`, `subcategory`/`subcategoryId`, and `form`/`productFormId`, along with generic name, brand, supplier, stock status and expiry status.
- `/api/sales` — sale listing and sale creation.
- `/api/customers`, `/api/prescriptions`, `/api/suppliers`, `/api/expenses` — operational records.
- `/api/analytics` and `/api/reports` — profit/loss, forecasts, reorder suggestions and risk reports.
- `/api/sync` — authenticated web offline operation reconciliation.
- `/health` — backend readiness response.

Some list endpoints return `{ data, pagination }` with `page` and `limit` query parameters (default page size 25, maximum 100); others return raw arrays or resource objects. There is no repository-wide OpenAPI specification or single uniform response envelope confirmed. The endpoint and access matrix is in [Architecture](docs/architecture-diagram.md).

## Testing

Automated tests cover backend API integration/configuration, including taxonomy retrieval, product classification and filters; web tests cover IndexedDB/synchronization/status-indicator behavior and dependent taxonomy selection/filtering. There is no mobile test script. See [Test Plan](docs/test-plan.md) for the current suite and regression checks.

## Deployment overview

The checked-in deployment configuration describes a Render backend with PostgreSQL and a Vercel-hosted web client that proxies `/api/*` to the backend. The repository also contains a root Dockerfile and a Docker Compose configuration under `pharmacy-inventory`; treat these as alternate configuration, not evidence of an active production deployment. The mobile app's production distribution/release configuration is not currently documented/verified.

See [Deployment](docs/deployment.md) before deploying. Never put database credentials, JWT secrets, admin passwords or provider tokens in documentation or source control.

## Security considerations

- Keep production `JWT_SECRET` and PostgreSQL credentials in the deployment platform's secret store.
- Use HTTPS for production clients and backend; configure only intended browser origins in CORS.
- Preserve the backend's route guards, role checks, permission checks, active-account checks and password-change enforcement.
- Do not treat browser route protection as authorization; API authorization is authoritative.
- Customer records can contain health-related fields. Apply least privilege, limit access and avoid copying real personal/medical data into tests, logs or issue reports.
- Web auth session data is stored in local storage; mobile uses SecureStore. Offline browser data is not a database backup.
- Review migration effects and back up production data before operational changes.

## Development and contributions

Read [AGENTS.md](AGENTS.md) before asking an AI coding agent to change the repository. Follow established app boundaries, preserve API contracts and add/update focused tests for behavior changes. Keep changes small, run the nearest tests and available build/type checks, and review the complete diff. Update the relevant documentation when a material API, data model, workflow, architecture or deployment behavior changes.

## Documentation

- [Architecture diagram and API map](docs/architecture-diagram.md)
- [Database ERD](docs/database-erd.md)
- [Deployment guide](docs/deployment.md)
- [Software design document](docs/software-design-document.md)
- [Test plan](docs/test-plan.md)

## Future roadmap

No approved roadmap was found in the repository. The status table above records confirmed gaps rather than promising future features. Potential work such as a fuller prescription workflow, expanded mobile capabilities and additional tests requires product-owner confirmation before being treated as planned.
