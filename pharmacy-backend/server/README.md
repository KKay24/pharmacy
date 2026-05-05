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

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/test`

### Required production environment variables

- `DATABASE_URL`: Render Postgres connection string
- `JWT_SECRET`: long random secret
- `NODE_ENV=production`
- `FRONTEND_URL`: primary deployed frontend URL

## Auth

The API uses bearer tokens from `POST /api/auth/login`. The old `x-username` approach is disabled by default and can only be re-enabled in development with `ALLOW_LEGACY_DEV_AUTH=true`.
