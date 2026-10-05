# MediQuick Software Design Document

## 1. Document purpose

This document records the software structure and behavior confirmed in the repository. It is not a promise of regulatory compliance, production deployment status or a feature roadmap.

## 2. Product scope

MediQuick supports core pharmacy operations through a web application and a smaller mobile client. The system manages medicine catalog records, batch-level stock, sales, customer and prescription data, suppliers, expenses, staff access and selected analytics. The web PWA includes limited offline caching and transaction synchronization.

## 3. Design goals evidenced by the implementation

- Keep persisted business data and critical inventory rules in a shared backend.
- Track stock at batch level so expiry and costs are associated with received stock.
- Record stock changes as movement history.
- Apply authenticated, role/permission-aware API access.
- Support idempotent reconciliation for web offline operations.
- Serve web UI and mobile clients from the same API contract where they use shared resources.

No non-functional service-level targets, regulatory certification, formal threat model or approved roadmap were found in the repository.

## 4. Components and responsibilities

| Component | Responsibility |
|---|---|
| React web/PWA (`pharmacy-inventory`) | Route/page UI, inventory/POS forms, reports presentation, API calls, browser session state and selected local/offline data. |
| Web API proxy (`pharmacy-inventory/api`) | Forward `/api/*` requests to the configured canonical backend; does not implement pharmacy domain logic. |
| Expo mobile (`pharmacy-mobile`) | Login, inventory list, online POS checkout and profile navigation using the canonical API. |
| Backend API (`pharmacy-backend/server`) | Authentication, authorization, validation, domain workflows, persistence and analytics. |
| Sequelize models/services | Map backend logic to entities and database transactions. |
| PostgreSQL | Production system of record. |
| SQLite | Local/test database option only. |
| Browser IndexedDB/service worker | Web app shell, selected cached data and pending offline operation queue; not authoritative persistence. |

See [Architecture](architecture-diagram.md) and [Database ERD](database-erd.md) for diagrams and entity details.

## 5. Runtime and module structure

The backend starts from `server/src/main.js`, creates the Nest application with an Express adapter and registers the modules/controllers/services in `server/src/app.module.js`. Resource controllers define routes and guards. Business logic is grouped into services in the same resource folders. Database models/associations are under `server/models`; ordered migrations are under `server/migrations`.

The web app is a React 19/Create React App application. `App.js` composes router-level pages and protected-route UI behavior. `DataContext` loads shared data and maintains web client state; utility modules own HTTP/auth storage, IndexedDB and synchronization.

The mobile app uses Expo Router route groups. Auth state lives in a React context; the Axios client supplies base URL and bearer token.

## 6. Key domain workflows

### 6.1 Authentication and access control

1. Client submits credentials to `POST /api/auth/login`.
2. Backend normalizes the username, verifies the scrypt password hash and rejects suspended users.
3. Backend returns a signed HMAC-SHA256 access token and serialized user.
4. Client stores session data (browser local storage for web; Expo SecureStore for mobile) and sends bearer token on protected requests.
5. Backend token guard verifies signature/expiration and reloads the user. Route guards and service logic enforce role/permission constraints.

The roles are `admin`, `manager` and `user`, with permissions defined centrally in `src/auth/permissions.js`. The web client also hides/restricts routes by role, but backend guards remain authoritative.

### 6.2 Product, receiving and stock control

Medicines represent product identity/catalog metadata. The `InventoryCategories` reference tree holds main categories, their subcategories and allowed product forms. A medicine stores nullable foreign keys for those three levels; the main category is required when creating a new product, while subcategory and form are optional. The inventory service validates level/parent relationships, and the authenticated `GET /api/inventory/categories` endpoint supplies the tree used by dependent web selectors. Existing `category`/`dosage` text values remain for compatibility and safe handling of older records.

Brand, strength, pack size and unit of measure are separate medicine metadata; batch-level cost/selling prices, expiry and quantity remain attached to `Batches`. `POST /api/inventory/batch` receives stock and creates stock movement records. The service normalizes product identity and uses database uniqueness/indexing to avoid silent product/batch duplication. Migration `011` seeds reference data idempotently, maps recognizable legacy values without deleting source text or stock, and indexes category references.

`GET /api/inventory/low-stock` compares batch-derived quantity with each product's threshold. `GET /api/inventory/:id/movements` returns recorded movement history. Inventory listing supports category, subcategory and form IDs (or names), generic name, brand, supplier, stock status and expiry status. Repeated form names can match all valid taxonomy nodes unless scoped by a parent filter.

### 6.3 Sales

Web and mobile POS clients submit sale data to `POST /api/sales`. The backend validates sale quantities/totals, resolves the medicine, checks stock and updates batches and sale records transactionally. It deducts quantities from batches ordered by expiry date and writes one or more movement records. The web PWA's operation queue sends supported offline operations to `/api/sync` with client transaction identifiers; the sync service checks permissions, detects prior processing and reports errors/conflicts.

### 6.4 Customers and prescriptions

Customer records can be associated with sales and prescriptions. The model contains optional customer contact and health-related fields. The current prescription API supports listing, creation and status updates. A full prescription dispensing, validation, refill, e-prescribing or pharmacy-clinical workflow is not established by these routes/models.

### 6.5 Analytics and reports

The API builds a monthly profit/loss summary from sales and expenses and provides forecast, reorder, stockout, expiry-risk and dead-stock analytics. The web reports screen creates additional daily/weekly/monthly ledger views from loaded sales and stores daily shortages locally in the browser.

## 7. API design

API paths use resource groupings under `/api`; requests use JSON for the observed application workflows. Protected calls use a bearer token. The public readiness endpoint is `/health`.

Current response shapes are not globally normalized:

- Paginated endpoints using the shared helper return `{ data, pagination: { total, page, limit, totalPages } }`.
- Pagination defaults to page 1/limit 25 and caps requested limit at 100.
- Other operations can return raw arrays, individual model/resource records or endpoint-specific objects.
- Not-found, validation, authentication and authorization failures use framework/service errors; an API-wide response schema has not been documented.

There is no repository-verified OpenAPI specification. Taxonomy and inventory filter parameters are documented above; the concrete route/access listing is in [Architecture](architecture-diagram.md#api-and-access-matrix).

## 8. Persistence and consistency

Production uses PostgreSQL through Sequelize. Data changes that span a sale, batch quantities and movement history are performed in a database transaction in the sales service. Unique indexes support product/batch identity and client transaction idempotency. Migrations are versioned and run in development startup and through the checked-in production build command.

The browser offline store is an eventual synchronization mechanism for supported operations, not a second authoritative database. Server-side stock is validated at sync time and can produce a conflict. Operations must not be silently removed before successful or explicitly resolved reconciliation.

## 9. Security and privacy design constraints

- Secrets are supplied through environment/deployment configuration.
- Passwords are stored as scrypt hashes; bearer tokens are signed with `JWT_SECRET`.
- Authentication and role/permission checks are implemented in the API.
- CORS origins are configured for production.
- Customer records can include sensitive personal/health data; access and logging should be minimized.
- Web token/session data is in browser local storage, whereas the mobile client uses SecureStore.
- Client caches are not backups and should not be presented as guaranteed recovery.

This section describes controls visible in source, not an independent security certification.

## 10. Configuration and deployment

The root Render blueprint configures backend/PostgreSQL resources; the web project's Vercel config routes API calls through a proxy. Backend production startup requires PostgreSQL `DATABASE_URL` and `JWT_SECRET`, and rejects SQLite. The complete deployment procedure and unknowns are documented in [Deployment](deployment.md).

## 11. Known limits and status

| Capability | Status |
|---|---|
| Shared API for web/mobile, inventory, receiving, POS, customers, suppliers and expenses | Implemented |
| Batch expiry and stock movement persistence | Implemented |
| Product category/subcategory/form hierarchy | Implemented through seeded reference data and medicine references; subcategory and form remain optional, and ambiguous legacy values remain unclassified |
| Prescription record creation and status update | Implemented as a limited record workflow |
| Prescription OCR/dispensing integration | Not currently documented/verified |
| Web PWA local cache and queued sale/restock/adjustment sync | Implemented with server reconciliation |
| Equivalent offline mobile workflows | Not implemented/verified |
| Monthly backend profit/loss and analytics | Implemented; see route/service limits |
| Browser-local daily shortage/ledger state | Partially implemented as client-side reporting |
| Approved roadmap | Not currently documented/verified |

## 12. Design change guidance

Before changing architecture or data behavior, identify all clients and API consumers, inspect model associations/migrations, preserve permission/idempotency semantics, add focused tests and update this document plus the relevant architecture/ERD/deployment docs. Do not present inferred capabilities as implemented.
