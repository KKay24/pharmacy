# Deployment Guide

This guide covers multiple deployment options for the Pharmacy Inventory Management System.

## Table of Contents

1. [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
2. [Docker Deployment](#docker-deployment)
3. [Traditional Hosting](#traditional-hosting)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Troubleshooting](#troubleshooting)

---

## Vercel Deployment (Recommended)

Vercel is the recommended platform for deploying this application due to its seamless integration with React and serverless functions.

### Prerequisites

- Vercel account (free tier available at [vercel.com](https://vercel.com))
- PostgreSQL database (recommended: [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), [Neon](https://neon.tech), or [Supabase](https://supabase.com))
- Git repository (GitHub, GitLab, or Bitbucket)

### Step 1: Prepare Your Database

#### Option A: Vercel Postgres (Recommended)

1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database
3. Select "Postgres" and follow the setup wizard
4. Copy the `POSTGRES_URL` connection string

#### Option B: External PostgreSQL Provider

Choose a PostgreSQL provider:
- **Neon** ([neon.tech](https://neon.tech)) - Serverless PostgreSQL
- **Supabase** ([supabase.com](https://supabase.com)) - Open source Firebase alternative
- **ElephantSQL** ([elephantsql.com](https://elephantsql.com)) - PostgreSQL as a service

Get your PostgreSQL connection string in the format:
```
postgresql://username:password@host:port/database?sslmode=require
```

### Step 2: Deploy to Vercel

#### Via Vercel Dashboard (Easy)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Configure your project:
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

5. Add environment variables:
   - Key: `POSTGRES_URL`
   - Value: Your PostgreSQL connection string
   - Environment: Production, Preview, Development

6. Click "Deploy"

#### Via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy from project root:
```bash
vercel
```

4. Follow the prompts:
   - Set up and deploy? `Y`
   - Which scope? Select your account
   - Link to existing project? `N` (first time) or `Y` (updates)
   - Project name? `pharmacy-inventory`
   - Directory? `./`
   - Override settings? `N`

5. Add environment variables:
```bash
vercel env add POSTGRES_URL
```
Paste your PostgreSQL connection string when prompted.

6. Deploy to production:
```bash
vercel --prod
```

### Step 3: Post-Deployment Configuration

1. **Verify deployment**: Visit your Vercel URL
2. **Test API endpoints**: Navigate to `https://your-app.vercel.app/api/test`
3. **Check database**: Login with default credentials (admin/1234)
4. **Update DNS** (optional): Add custom domain in Vercel dashboard

### Vercel Configuration Details

The `vercel.json` file is pre-configured with:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This configuration:
- Routes all `/api/*` requests to the serverless function in `api/index.js`
- Routes all other requests to the React app
- Enables client-side routing for React Router

### Important Notes for Vercel

- **Cold Starts**: First request may be slower (5-10 seconds) after inactivity
- **Function Timeout**: Free tier has 10-second timeout for serverless functions
- **Database Persistence**: Always use PostgreSQL in production (SQLite in-memory is only for fallback)
- **Build Time**: Typical build time is 1-3 minutes
- **Automatic Deployments**: Vercel automatically deploys on git push to main branch

---

## Docker Deployment

Docker provides a containerized, consistent environment for running the application.

### Prerequisites

- Docker Engine 20.x or higher
- Docker Compose 2.x or higher

### Quick Start with Docker Compose

1. **Create environment file**:

```bash
# Create .env file
cat > .env << EOF
POSTGRES_URL=postgresql://postgres:password@db:5432/pharmacy
NODE_ENV=production
PORT=5001
EOF
```

2. **Build and start containers**:

```bash
docker-compose up -d
```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - API: http://localhost:5001/api/test

4. **Stop containers**:

```bash
docker-compose down
```

5. **Stop and remove data**:

```bash
docker-compose down -v
```

### Docker Compose Configuration

The `docker-compose.yml` includes:
- **app**: React frontend + Express backend
- **db**: PostgreSQL database
- **volumes**: Persistent database storage

### Manual Docker Build

#### Build the image:

```bash
docker build -t pharmacy-inventory .
```

#### Run with external PostgreSQL:

```bash
docker run -d \
  -p 3000:3000 \
  -e POSTGRES_URL="your_connection_string" \
  --name pharmacy-app \
  pharmacy-inventory
```

#### Run with SQLite (not recommended for production):

```bash
docker run -d \
  -p 3000:3000 \
  -v pharmacy-data:/app/server/config \
  --name pharmacy-app \
  pharmacy-inventory
```

### Docker Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_URL` | PostgreSQL connection string | Yes (production) |
| `PORT` | Backend server port | No (default: 5001) |
| `NODE_ENV` | Environment mode | No (default: production) |

### Docker Production Considerations

1. **Multi-stage builds**: The Dockerfile uses multi-stage builds to optimize image size
2. **Security**: Runs as non-root user
3. **Health checks**: Included in docker-compose.yml
4. **Logging**: Logs available via `docker logs pharmacy-app`
5. **Updates**: 
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

### Docker Deployment Platforms

You can deploy the Docker container to:

- **AWS ECS/Fargate**: Managed container service
- **Google Cloud Run**: Fully managed serverless containers
- **Azure Container Instances**: Serverless containers
- **DigitalOcean App Platform**: PaaS with container support
- **Railway**: Modern infrastructure platform
- **Render**: Cloud application hosting
- **Fly.io**: Global application platform

---

## Traditional Hosting

### VPS or Dedicated Server Deployment

#### Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Node.js 16+ installed
- PostgreSQL 12+ installed
- Nginx (recommended as reverse proxy)
- PM2 (for process management)

#### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

#### Step 2: Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE pharmacy;
CREATE USER pharmacyuser WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE pharmacy TO pharmacyuser;
\q
```

#### Step 3: Application Setup

```bash
# Clone repository
git clone <repository-url> /var/www/pharmacy-inventory
cd /var/www/pharmacy-inventory

# Install dependencies
npm install

# Create environment file
cat > .env << EOF
POSTGRES_URL=postgresql://pharmacyuser:your_secure_password@localhost:5432/pharmacy
NODE_ENV=production
PORT=5001
EOF

# Build React frontend
npm run build

# Install serve for production
npm install -g serve
```

#### Step 4: PM2 Configuration

Create PM2 ecosystem file:

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'pharmacy-backend',
      script: './server/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      instances: 2,
      exec_mode: 'cluster'
    },
    {
      name: 'pharmacy-frontend',
      script: 'serve',
      args: '-s build -l 3000',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF
```

Start applications:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Step 5: Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/pharmacy
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/pharmacy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `5001` |
| `NODE_ENV` | Environment mode | `development` |
| `VERCEL` | Vercel environment indicator | Auto-set by Vercel |

### Setting Environment Variables

#### Vercel
```bash
vercel env add POSTGRES_URL
```

#### Docker
Add to `.env` file or `docker-compose.yml`

#### Traditional Hosting
Add to `.env` file in project root

---

## Database Setup

### PostgreSQL Schema

The application automatically creates and syncs database tables on startup using Sequelize ORM.

Tables created:
- `Users` - Authentication
- `Medicines` - Medicine catalog
- `Batches` - Stock batches with expiry tracking
- `Sales` - Transaction records
- `Customers` - Customer information
- `Prescriptions` - Prescription management

### Initial Data

On first startup, an admin user is automatically created:
- **Username**: admin
- **Password**: 1234

**Important**: Change these credentials immediately after deployment!

### Database Backups

#### PostgreSQL Backup

```bash
# Create backup
pg_dump -h hostname -U username -d pharmacy > backup_$(date +%Y%m%d).sql

# Restore backup
psql -h hostname -U username -d pharmacy < backup_20260205.sql
```

#### Automated Backups

Set up a cron job:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * pg_dump -h localhost -U pharmacyuser -d pharmacy > /backups/pharmacy_$(date +\%Y\%m\%d).sql
```

---

## Troubleshooting

### Common Issues

#### 1. API not connecting

**Symptoms**: Frontend loads but API calls fail

**Solutions**:
- Check `POSTGRES_URL` environment variable is set correctly
- Verify database is accessible
- Check serverless function logs in Vercel dashboard
- Test API endpoint directly: `https://your-app.vercel.app/api/test`

#### 2. Database connection errors

**Symptoms**: "Connection refused" or timeout errors

**Solutions**:
- Verify PostgreSQL is running
- Check connection string format
- Ensure SSL is properly configured
- Verify database firewall rules allow connections
- Check if database requires `sslmode=require` parameter

#### 3. Build failures

**Symptoms**: Deployment fails during build

**Solutions**:
- Clear build cache: `vercel --force` or delete `node_modules`
- Check Node.js version compatibility
- Verify all dependencies are in `package.json`
- Check build logs for specific error messages

#### 4. Cold start delays (Vercel)

**Symptoms**: First request takes 5-10 seconds

**Solutions**:
- This is normal for serverless functions on free tier
- Upgrade to Pro plan for faster cold starts
- Consider implementing keep-alive pings
- Use Vercel's Edge Functions for better performance

#### 5. Database not persisting (Docker)

**Symptoms**: Data lost after container restart

**Solutions**:
- Ensure Docker volumes are properly configured
- Don't use SQLite in production
- Use PostgreSQL with persistent volume:
  ```yaml
  volumes:
    - postgres_data:/var/lib/postgresql/data
  ```

### Logs and Debugging

#### Vercel Logs
```bash
vercel logs
vercel logs --follow  # Real-time logs
```

#### Docker Logs
```bash
docker-compose logs app
docker-compose logs db
docker-compose logs -f  # Follow mode
```

#### PM2 Logs
```bash
pm2 logs
pm2 logs pharmacy-backend
pm2 logs pharmacy-frontend
```

### Performance Optimization

1. **Enable caching**: Configure nginx caching for static assets
2. **Database indexing**: Add indexes to frequently queried columns
3. **Connection pooling**: Sequelize handles this automatically
4. **CDN**: Use Vercel's CDN or CloudFlare for static assets
5. **Code splitting**: React lazy loading (already implemented with route-based splitting)

### Security Best Practices

1. **Change default credentials** immediately
2. **Use strong passwords** for database
3. **Enable HTTPS** (automatic on Vercel)
4. **Set secure environment variables**
5. **Regular backups** of database
6. **Keep dependencies updated**: `npm audit fix`
7. **Implement rate limiting** for API endpoints
8. **Use CORS properly** configured for your domain

### Getting Help

If you encounter issues not covered here:

1. Check application logs
2. Review Vercel/Docker/server logs
3. Verify environment variables are set correctly
4. Test database connection independently
5. Create an issue in the repository with:
   - Deployment platform
   - Error messages
   - Steps to reproduce
   - Environment details

---

## Deployment Comparison

| Feature | Vercel | Docker | Traditional VPS |
|---------|--------|--------|----------------|
| Setup Time | 5 minutes | 15 minutes | 30-60 minutes |
| Cost (Free Tier) | Yes | No (hosting needed) | No (server cost) |
| Scalability | Automatic | Manual | Manual |
| Maintenance | Low | Medium | High |
| Cold Starts | Yes | No | No |
| Best For | Quick deployment, MVPs | Consistent environments | Full control |

## Recommended Setup

- **Development**: Local with SQLite
- **Staging**: Vercel with Vercel Postgres
- **Production**: Vercel with dedicated PostgreSQL (Neon/Supabase) or Docker on VPS

---

For additional support or questions, please refer to the main [README.md](../README.md) or create an issue in the repository.
