# Architecture Overview

## System Architecture

The Pharmacy Inventory Management System is a full-stack web application with a clear separation between frontend and backend.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Frontend (Port 3000)                │ │
│  │  ┌──────────┬──────────┬──────────┬─────────────────┐ │ │
│  │  │Dashboard │Inventory │   POS    │  Prescriptions  │ │ │
│  │  └──────────┴──────────┴──────────┴─────────────────┘ │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │          React Router (Client-side)               │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS / REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                       API LAYER                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Express.js Backend (Port 5001)              │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │                API Routes                        │ │ │
│  │  │  /api/auth     /api/inventory   /api/sales      │ │ │
│  │  │  /api/customers /api/prescriptions              │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │             Middleware Layer                     │ │ │
│  │  │   CORS │ JSON Parser │ Error Handler            │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                    Sequelize ORM
                            │
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │      PostgreSQL / SQLite (Dev) Database              │ │
│  │  ┌────────┬────────┬────────┬──────────┬───────────┐ │ │
│  │  │ Users  │Medicines│Batches │ Sales   │Customers  │ │ │
│  │  └────────┴────────┴────────┴──────────┴───────────┘ │ │
│  │  ┌─────────────────┐                                 │ │
│  │  │  Prescriptions  │                                 │ │
│  │  └─────────────────┘                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 19
- **Routing**: React Router v7
- **State Management**: React Context API
- **UI Components**: Custom components with Lucide React icons
- **Charts**: Recharts
- **Notifications**: React Hot Toast
- **OCR**: Tesseract.js
- **File Export**: xlsx, file-saver
- **Printing**: react-to-print

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Sequelize
- **Database**: PostgreSQL (production), SQLite (development)
- **Middleware**: CORS, express.json()

### Deployment
- **Vercel**: Serverless functions (recommended)
- **Docker**: Container orchestration
- **Traditional**: PM2 + Nginx

## Data Model

### Entity Relationship Diagram

```
┌─────────────┐
│    Users    │
│─────────────│
│ id (PK)     │
│ username    │
│ password    │
└─────────────┘

┌──────────────┐         ┌──────────────┐
│  Medicines   │◄───┐    │   Batches    │
│──────────────│    │    │──────────────│
│ id (PK)      │    └────│ medicineId   │
│ name         │         │ batchNumber  │
│ company      │         │ expiryDate   │
│ category     │         │ quantity     │
│ description  │         │ costPrice    │
└──────────────┘         │ sellingPrice │
      │                  └──────────────┘
      │                         │
      │                         │
      │                         ▼
      │                  ┌──────────────┐
      └──────────────────►    Sales     │
                         │──────────────│
                         │ id (PK)      │
                         │ medicineId   │
                         │ batchId      │
                         │ customerId   │
                         │ quantity     │
                         │ totalPrice   │
                         │ profit       │
                         │ date         │
                         └──────────────┘
                                │
                                │
┌──────────────┐                │
│  Customers   │◄───────────────┘
│──────────────│
│ id (PK)      │
│ name         │
│ phone        │
│ email        │
│ address      │
└──────────────┘
      │
      │
      ▼
┌──────────────────┐
│  Prescriptions   │
│──────────────────│
│ id (PK)          │
│ customerId       │
│ imageUrl         │
│ extractedText    │
│ status           │
│ notes            │
└──────────────────┘
```

## Application Flow

### 1. User Authentication Flow

```
User Login
    │
    ├──► POST /api/auth/login
    │         │
    │         ├──► Validate credentials
    │         │
    │         ├──► Query Users table
    │         │
    │         └──► Return user data or error
    │
    └──► Store user in Context
              │
              └──► Redirect to Dashboard
```

### 2. Inventory Management Flow

```
View Inventory
    │
    ├──► GET /api/inventory/medicines
    │         │
    │         ├──► Fetch all medicines with batches
    │         │
    │         └──► Return medicine list
    │
    ├──► Display in InventoryTable component
    │
    └──► Actions available:
              ├──► Add new medicine
              ├──► Update medicine
              ├──► Delete medicine
              └──► Add new batch
```

### 3. Point of Sale (POS) Flow

```
Initiate Sale
    │
    ├──► Select customer (or create new)
    │
    ├──► Add items to cart
    │         │
    │         └──► Check batch availability
    │
    ├──► Calculate totals
    │         │
    │         ├──► Sum item prices
    │         └──► Calculate profit margins
    │
    ├──► Submit sale
    │         │
    │         └──► POST /api/sales
    │                   │
    │                   ├──► Create sale records
    │                   ├──► Update batch quantities
    │                   └──► Return transaction details
    │
    └──► Generate receipt
              │
              └──► Print or download
```

### 4. Prescription Processing Flow

```
Upload Prescription
    │
    ├──► Upload image
    │
    ├──► OCR processing (Tesseract.js)
    │         │
    │         └──► Extract text from image
    │
    ├──► POST /api/prescriptions
    │         │
    │         └──► Save prescription with extracted text
    │
    └──► Review and fulfill
              │
              ├──► Associate with customer
              └──► Create sale from prescription
```

## Deployment Architectures

### Vercel Deployment

```
┌──────────────────────────────────────────────┐
│              Vercel Edge Network              │
│  ┌────────────────────────────────────────┐  │
│  │         CDN (Static Assets)            │  │
│  │  React Build / Images / Fonts          │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │    Serverless Functions (API)          │  │
│  │    /api/* → Lambda-like functions      │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  PostgreSQL Database │
         │  (Vercel Postgres/   │
         │   Neon/Supabase)     │
         └──────────────────────┘
```

### Docker Deployment

```
┌─────────────────────────────────────────────┐
│          Docker Host (Server/VPS)            │
│  ┌───────────────────────────────────────┐  │
│  │     pharmacy-network (Bridge)         │  │
│  │                                        │  │
│  │  ┌──────────────────────────────────┐ │  │
│  │  │      pharmacy-app container      │ │  │
│  │  │  ┌────────────┬────────────────┐ │ │  │
│  │  │  │  Frontend  │    Backend     │ │ │  │
│  │  │  │  (Port     │    (Port       │ │ │  │
│  │  │  │   3000)    │     5001)      │ │ │  │
│  │  │  └────────────┴────────────────┘ │ │  │
│  │  └──────────────────────────────────┘ │  │
│  │                  │                     │  │
│  │                  ▼                     │  │
│  │  ┌──────────────────────────────────┐ │  │
│  │  │      pharmacy-db container       │ │  │
│  │  │      PostgreSQL 15-alpine        │ │  │
│  │  │      (Port 5432)                 │ │  │
│  │  │  ┌──────────────────────────┐    │ │  │
│  │  │  │  postgres_data volume    │    │ │  │
│  │  │  └──────────────────────────┘    │ │  │
│  │  └──────────────────────────────────┘ │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Traditional VPS Deployment

```
┌─────────────────────────────────────────────┐
│                 VPS Server                   │
│  ┌───────────────────────────────────────┐  │
│  │           Nginx (Port 80/443)         │  │
│  │        Reverse Proxy + SSL            │  │
│  └────┬──────────────────────────────┬───┘  │
│       │                              │       │
│       ▼                              ▼       │
│  ┌─────────────┐            ┌─────────────┐ │
│  │   PM2       │            │   PM2       │ │
│  │  Frontend   │            │  Backend    │ │
│  │   (serve)   │            │ (server.js) │ │
│  │  Port 3000  │            │  Port 5001  │ │
│  └─────────────┘            └──────┬──────┘ │
│                                    │         │
│                                    ▼         │
│               ┌──────────────────────────┐  │
│               │  PostgreSQL Database     │  │
│               │  Port 5432               │  │
│               └──────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Inventory
- `GET /api/inventory/medicines` - Get all medicines
- `GET /api/inventory/medicines/:id` - Get single medicine
- `POST /api/inventory/medicines` - Create medicine
- `PUT /api/inventory/medicines/:id` - Update medicine
- `DELETE /api/inventory/medicines/:id` - Delete medicine
- `POST /api/inventory/batches` - Add batch to medicine

### Sales
- `GET /api/sales` - Get all sales
- `GET /api/sales/:id` - Get single sale
- `POST /api/sales` - Create sale
- `GET /api/sales/stats` - Get sales statistics
- `GET /api/sales/profit-loss` - Get profit/loss report

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Prescriptions
- `GET /api/prescriptions` - Get all prescriptions
- `GET /api/prescriptions/:id` - Get single prescription
- `POST /api/prescriptions` - Create prescription
- `PUT /api/prescriptions/:id` - Update prescription
- `DELETE /api/prescriptions/:id` - Delete prescription

## Security Considerations

### Current Implementation
- Password stored in plain text (for demo)
- Basic authentication via username/password
- CORS enabled for cross-origin requests
- Environment variables for sensitive data

### Recommended Enhancements for Production
1. **Authentication**
   - Implement JWT tokens
   - Use bcrypt for password hashing
   - Add session management
   - Implement refresh tokens

2. **Authorization**
   - Role-based access control (RBAC)
   - Permission-based routing
   - API endpoint protection

3. **Data Security**
   - Input validation and sanitization
   - SQL injection prevention (Sequelize helps)
   - XSS protection
   - Rate limiting on API endpoints

4. **Infrastructure**
   - HTTPS only (enforced)
   - Security headers (CSP, HSTS, etc.)
   - Regular security audits
   - Dependency vulnerability scanning

## Performance Optimization

### Current Optimizations
- React code splitting (route-based)
- Production build minification
- Sequelize connection pooling
- Static asset caching

### Recommended Enhancements
1. **Frontend**
   - Implement React.lazy for component-level code splitting
   - Add service worker for offline capability
   - Implement virtual scrolling for large lists
   - Optimize images (WebP, lazy loading)

2. **Backend**
   - Add Redis caching layer
   - Implement database query optimization
   - Add database indexes for frequent queries
   - Use connection pooling

3. **Infrastructure**
   - CDN for static assets
   - Load balancing for high traffic
   - Database read replicas
   - Horizontal scaling

## Monitoring and Logging

### Recommended Implementation
1. **Application Monitoring**
   - Error tracking (Sentry, Rollbar)
   - Performance monitoring (New Relic, DataDog)
   - User analytics (Google Analytics, Mixpanel)

2. **Infrastructure Monitoring**
   - Server metrics (CPU, memory, disk)
   - Database performance
   - API response times
   - Uptime monitoring

3. **Logging**
   - Structured logging (Winston, Pino)
   - Centralized log aggregation
   - Log rotation and retention
   - Alert on critical errors

## Scalability Considerations

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Optimize database queries
- Add caching layer

### Horizontal Scaling
- Multiple application instances behind load balancer
- Database read replicas
- CDN for static assets
- Microservices architecture (future consideration)

## Backup and Disaster Recovery

### Database Backups
- Automated daily backups
- Backup retention policy (30 days recommended)
- Regular backup testing
- Off-site backup storage

### Application Backups
- Git repository (code)
- Environment configuration backups
- Uploaded files backup (prescriptions, etc.)

### Recovery Plan
1. Database restoration from backup
2. Application redeployment from git
3. Configuration restoration
4. Data verification
5. Service validation

## Future Enhancements

### Potential Features
1. **Multi-tenant support** - Multiple pharmacy locations
2. **Inventory forecasting** - AI-based stock predictions
3. **Mobile apps** - React Native or PWA
4. **Third-party integrations** - Payment gateways, SMS, email
5. **Advanced reporting** - Business intelligence dashboard
6. **Barcode scanning** - Faster item lookup
7. **Supplier management** - Track orders and suppliers
8. **Automated alerts** - Low stock, expiring items
9. **Multi-currency support** - International operations
10. **Advanced user roles** - Pharmacist, cashier, manager, admin

---

For implementation details, refer to:
- [README.md](../README.md) - Project overview
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [DOCKER.md](./DOCKER.md) - Docker operations
