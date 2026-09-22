# Pharmacy Inventory Management System

A comprehensive pharmacy inventory management system built with React, featuring point-of-sale (POS), prescription management, inventory tracking, and financial reporting.

## Canonical Backend

The web client now targets the shared backend in `../pharmacy-backend/server`.

- Local web development should use `REACT_APP_API_BASE_URL=http://localhost:5001`
- Production Vercel API traffic is proxied to the canonical backend from `api/index.js`
- The legacy `server/` folder in this repo is no longer the source of truth for API development

## Vercel deployment

Deploy this repo to Vercel and keep the API on Render.

### Vercel project settings

- Framework preset: `Create React App`
- Build command: `npm run build`
- Output directory: `build`

### Required Vercel environment variables

- `BACKEND_API_URL=https://your-render-service.onrender.com`

### Recommended Vercel environment behavior

- Leave `REACT_APP_API_BASE_URL` unset in Vercel so the browser uses same-origin `/api/*` requests.
- The checked-in [`vercel.json`](./vercel.json) rewrites `/api/*` to the local proxy function and sends SPA routes to `index.html`.
- After the first Vercel deployment, copy the final production domain into the backend's Render `FRONTEND_URL` value so CORS is locked to the correct origin.

## Features

- **Dashboard**: Real-time overview of inventory, sales, and financial metrics
- **Inventory Management**: Track medicines, batches, and stock levels
- **Point of Sale (POS)**: Quick and efficient sales transactions
- **Prescription Management**: Handle and track customer prescriptions with OCR support
- **Profit & Loss Reports**: Financial analytics and reporting
- **Customer Management**: Track customer information and purchase history
- **Authentication**: Secure login system for pharmacy staff

## Tech Stack

### Frontend
- React 19
- React Router for navigation
- Recharts for data visualization
- React Hot Toast for notifications
- Lucide React for icons
- Tesseract.js for OCR functionality

### Backend
- Express.js
- Sequelize ORM
- PostgreSQL (production) / SQLite (development)
- CORS enabled

## Project Structure

```
pharmacy-inventory/
├── api/                    # Vercel serverless function wrapper
├── public/                 # Static assets
├── server/                 # Backend Express application
│   ├── config/            # Database configuration
│   ├── models/            # Sequelize models
│   └── routes/            # API routes
├── src/                   # Frontend React application
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── context/          # React context providers
│   └── styles/           # CSS modules
└── vercel.json           # Vercel deployment configuration
```

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- PostgreSQL (for production) or SQLite (auto-configured for development)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pharmacy-inventory
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

### Default Credentials

- **Username**: admin
- **Password**: Set through the controlled admin seed process.

> ⚠️ **Security Note**: Change the default credentials immediately in production!

## Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm run build`
Builds the app for production to the `build` folder.

### `npm test`
Launches the test runner in interactive watch mode.

## Backend Configuration

This frontend does not connect to a database directly.

- **Local development**: point `REACT_APP_API_BASE_URL` at `http://localhost:5001`
- **Vercel production**: set `BACKEND_API_URL` to the Render backend URL
- **Database choice**: SQLite vs PostgreSQL is handled by the backend service, not the React app

## Deployment

Multiple deployment options available to suit your needs:

### Recommended production setup

- Backend: Render
- Database: Render Postgres
- Web app: Vercel

### 🚀 Quick Start
New to deployment? Start here: **[QUICK-START.md](./QUICK-START.md)**

### 📚 Complete Documentation
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Comprehensive deployment guide (Vercel, Docker, VPS)
- **[DEPLOYMENT-SUMMARY.md](./docs/DEPLOYMENT-SUMMARY.md)** - Quick reference and comparison
- **[DEPLOYMENT-CHECKLIST.md](./docs/DEPLOYMENT-CHECKLIST.md)** - Step-by-step verification
- **[DOCKER.md](./docs/DOCKER.md)** - Docker-specific operations guide
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture and design
- **[DOCUMENTATION-INDEX.md](./docs/DOCUMENTATION-INDEX.md)** - Complete documentation index

### ⚡ Quick Deploy Commands

**Vercel (5 minutes)**:
```bash
npm install -g vercel && vercel --prod
```

**Docker (15 minutes)**:
```bash
docker-compose up -d
```

**Local Development**:
```bash
npm start
```

See [DEPLOYMENT-SUMMARY.md](./docs/DEPLOYMENT-SUMMARY.md) for detailed comparison of deployment options.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Inventory
- `GET /api/inventory/medicines` - Get all medicines
- `POST /api/inventory/medicines` - Add new medicine
- `PUT /api/inventory/medicines/:id` - Update medicine
- `DELETE /api/inventory/medicines/:id` - Delete medicine
- `POST /api/inventory/batches` - Add new batch

### Sales
- `POST /api/sales` - Record new sale
- `GET /api/sales` - Get all sales
- `GET /api/sales/stats` - Get sales statistics

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Add new customer
- `PUT /api/customers/:id` - Update customer

### Prescriptions
- `GET /api/prescriptions` - Get all prescriptions
- `POST /api/prescriptions` - Add new prescription
- `PUT /api/prescriptions/:id` - Update prescription status

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Support

For issues, questions, or contributions, please create an issue in the repository.
