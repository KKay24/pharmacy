# API Contract

## Canonical backend

`pharmacy-backend/server` is the single backend source of truth for the project.

## Authentication

- `POST /api/auth/login`
  - Request: `{ "username": "admin@example.com", "password": "<bootstrap-password>" }`
  - Response: `{ "token": "...", "user": { ... } }`
- `GET /api/auth/me`
  - Requires `Authorization: Bearer <token>`

## User Administration

- `GET /api/auth/users`
- `POST /api/auth/users`
- `PATCH /api/auth/users/:id/status`
- `DELETE /api/auth/users/:id`

All user administration endpoints require an `admin` token.

## Operational APIs

- `GET /api/inventory`
- `GET /api/inventory/low-stock`
- `POST /api/inventory`
- `POST /api/inventory/batch`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`
- `GET /api/sales`
- `POST /api/sales`
- `GET /api/customers`
- `GET /api/customers/search?q=...`
- `GET /api/customers/:id`
- `POST /api/customers`
- `GET /api/prescriptions`
- `POST /api/prescriptions`
- `PUT /api/prescriptions/:id/status`
- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `DELETE /api/suppliers/:id`

## Analytics

- Canonical: `GET /api/analytics/profit-loss`
- Legacy compatibility alias: `GET /api/reports/analytics`

## Role Model

- `admin`: full access
- `manager`: operations, analytics, suppliers, customers, prescriptions, expenses
- `user`: inventory and sales only
