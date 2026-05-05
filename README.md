# MediQuick Workspace

This workspace contains three related apps:

- `pharmacy-backend/server`: canonical backend API
- `pharmacy-inventory`: React web client
- `pharmacy-mobile`: Expo mobile client

## Canonical local startup

1. Start the backend:

```bash
cd pharmacy-backend/server
cp .env.example .env
npm install
npm start
```

2. Start the web client:

```bash
cd pharmacy-inventory
cp .env.example .env
npm install
npm start
```

3. Start the mobile client:

```bash
cd pharmacy-mobile
cp .env.example .env
npm install
npm start
```

## Notes

- The backend in `pharmacy-backend/server` is the only supported API source of truth.
- `pharmacy-inventory/api/index.js` now proxies deployed web API traffic to the canonical backend.
- `pharmacy-inventory/server` remains in the repo as legacy code and should not be used for new work.

## Production deployment

Recommended split:

1. Deploy `pharmacy-backend/server` to Render.
2. Deploy `pharmacy-inventory` to Vercel.
3. After Vercel gives you a production URL, set `FRONTEND_URL` on Render to that exact domain.

Deployment config now lives in:

- `pharmacy-backend/server/render.yaml`
- `pharmacy-inventory/vercel.json`
