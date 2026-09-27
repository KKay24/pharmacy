# MediQuick Backend

This backend is the canonical API for the pharmacy project. The web client in `pharmacy-inventory` and the mobile client in `pharmacy-mobile` should both target this service.

## Local development

1. Copy `.env.example` to `.env`.
2. Start the API:

```bash
npm install
npm start
```

3. Optional demo data:

```bash
ENABLE_DEMO_SEEDING=true npm start
```

## Useful scripts

- `npm run migrate`
- `npm run audit:inventory-duplicates` (read-only; exits non-zero when review is needed)
- `npm test`

## Render deployment

This repo is ready to deploy to Render with the checked-in [`render.yaml`](./render.yaml).

### Recommended path

1. Create a new Blueprint in Render and point it at this repository.
2. Let Render create:
   - a `pharmacy-backend` web service
   - a `pharmacy-db` Postgres database
3. After your Vercel frontend is live, set these Render environment variables:
   - `FRONTEND_URL=https://your-production-app.vercel.app`
   - `FRONTEND_URLS=https://your-custom-domain.com` if you add a custom domain
4. Keep `ALLOW_VERCEL_PREVIEWS=true` if you want preview deployments on `*.vercel.app` to work against production.

### Manual service settings

If you prefer configuring Render in the dashboard instead of using the Blueprint, use:

- Build command: `npm install && npm run migrate`
- Start command: `npm start`
- Health check path: `/health`

### Required production environment variables

- `DATABASE_URL`: Render Postgres connection string
- `JWT_SECRET`: long random secret

Production startup requires both `DATABASE_URL` and `JWT_SECRET`. SQLite is
supported only for local development and tests; production startup rejects
SQLite configuration. Run `npm run seed` locally or through a controlled
deployment job with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to create the
first admin account.

Production backups must not be committed to Git. Store them in encrypted,
access-controlled storage with retention and restore procedures documented by
your deployment platform.

Production deployment order:

1. Install dependencies.
2. Run `npm run migrate` as the deployment step.
3. Start the application with `npm start`.

Production startup does not run migrations automatically. This avoids migration
work on every process restart and keeps schema changes explicit and observable.

## PostgreSQL backups and restore

Production data belongs in the managed PostgreSQL instance referenced by the
backend service's `DATABASE_URL` (the Render Blueprint names it `pharmacy-db`).
The filesystem and SQLite files are never a production source of truth.

Enable managed PostgreSQL backups and point-in-time recovery in the database
provider account, with encrypted off-provider exports only where your retention
policy requires them. Test restores into an isolated PostgreSQL database, run
`npm run migrate`, validate inventory and sales counts, and only then schedule a
controlled production restore. Do not restore by copying SQLite files or by
using `sync`, `--replace`, truncation, or schema reset commands.
- `NODE_ENV=production`
- `FRONTEND_URL`: primary deployed frontend URL

## Auth

The API uses bearer tokens from `POST /api/auth/login`. The old `x-username` approach is disabled by default and can only be re-enabled in development with `ALLOW_LEGACY_DEV_AUTH=true`.
