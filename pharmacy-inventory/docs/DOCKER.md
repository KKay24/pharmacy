# Docker Deployment Guide

Quick reference guide for running the Pharmacy Inventory Management System with Docker.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd pharmacy-inventory

# 2. Create environment file (optional - uses defaults if not provided)
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD

# 3. Build and start services
docker-compose up -d

# 4. Check status
docker-compose ps

# 5. View logs
docker-compose logs -f

# 6. Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5001/api/test
```

### Using Docker CLI Only

```bash
# Build image
docker build -t pharmacy-inventory .

# Run with external database
docker run -d \
  -p 3000:3000 \
  -p 5001:5001 \
  -e POSTGRES_URL="postgresql://user:pass@host:5432/pharmacy" \
  --name pharmacy-app \
  pharmacy-inventory

# View logs
docker logs -f pharmacy-app

# Stop container
docker stop pharmacy-app
```

## Docker Compose Services

### Services Overview

| Service | Description | Port |
|---------|-------------|------|
| `app` | React frontend + Express backend | 3000, 5001 |
| `db` | PostgreSQL 15 database | 5432 |

### Environment Variables

Set in `.env` file or pass to docker-compose:

```bash
POSTGRES_PASSWORD=your_secure_password
```

The app service automatically uses:
```
POSTGRES_URL=postgresql://pharmacyuser:${POSTGRES_PASSWORD}@db:5432/pharmacy
```

## Common Operations

### Start Services

```bash
# Start in foreground (see logs)
docker-compose up

# Start in background (detached)
docker-compose up -d

# Start and rebuild images
docker-compose up -d --build
```

### Stop Services

```bash
# Stop services (preserves data)
docker-compose stop

# Stop and remove containers (preserves data in volumes)
docker-compose down

# Stop, remove containers AND delete data volumes
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs app
docker-compose logs db

# Follow logs in real-time
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

### Database Operations

#### Access PostgreSQL CLI

```bash
docker-compose exec db psql -U pharmacyuser -d pharmacy
```

#### Create Database Backup

```bash
# Backup to file
docker-compose exec db pg_dump -U pharmacyuser pharmacy > backup_$(date +%Y%m%d).sql

# Or use pg_dump with compression
docker-compose exec db pg_dump -U pharmacyuser pharmacy | gzip > backup_$(date +%Y%m%d).sql.gz
```

#### Restore Database Backup

```bash
# From SQL file
docker-compose exec -T db psql -U pharmacyuser pharmacy < backup_20260205.sql

# From compressed file
gunzip -c backup_20260205.sql.gz | docker-compose exec -T db psql -U pharmacyuser pharmacy
```

#### Reset Database

```bash
# Stop services
docker-compose down

# Remove database volume
docker volume rm pharmacy-inventory_postgres_data

# Restart (creates fresh database)
docker-compose up -d
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart app
```

### Rebuild Application

```bash
# After code changes
docker-compose up -d --build app
```

### Scale Services (if needed)

```bash
# Run multiple app instances (requires load balancer)
docker-compose up -d --scale app=3
```

## Health Checks

Both services have health checks configured:

### Check Service Health

```bash
# View health status
docker-compose ps

# App health check
docker-compose exec app wget --spider http://localhost:5001/api/test

# Database health check
docker-compose exec db pg_isready -U pharmacyuser -d pharmacy
```

## Volume Management

### List Volumes

```bash
docker volume ls | grep pharmacy
```

### Inspect Volume

```bash
docker volume inspect pharmacy-inventory_postgres_data
```

### Backup Volume Data

```bash
# Create backup directory
mkdir -p backups

# Backup volume to tar archive
docker run --rm \
  -v pharmacy-inventory_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Volume Data

```bash
# Extract backup to volume
docker run --rm \
  -v pharmacy-inventory_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/postgres_data_20260205.tar.gz -C /data
```

## Networking

### Access Services from Host

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- PostgreSQL: localhost:5432

### Access Between Containers

Services communicate via the `pharmacy-network`:
- App connects to database: `db:5432`
- Internal DNS resolves service names

### Custom Network Configuration

To use custom network:

```yaml
networks:
  pharmacy-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

## Production Deployment

### Security Best Practices

1. **Change default passwords**:
```bash
# Generate secure password
openssl rand -base64 32
# Update .env file
```

2. **Use secrets for sensitive data**:
```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

3. **Run with user namespace mapping**:
```bash
docker-compose --userns-remap=default up -d
```

4. **Limit container resources**:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Environment-Specific Configs

#### Production

```bash
# Use production compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Staging

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

## Monitoring and Maintenance

### Resource Usage

```bash
# Container stats (CPU, memory, network)
docker stats pharmacy-app pharmacy-db

# Disk usage
docker system df

# Detailed disk usage
docker system df -v
```

### Cleanup

```bash
# Remove unused images
docker image prune

# Remove all stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Or with no cache
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Check if port is already in use
lsof -i :3000
lsof -i :5001

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Database Connection Issues

```bash
# Check if database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Test connection
docker-compose exec app node -e "require('pg').Client({connectionString: process.env.POSTGRES_URL}).connect().then(()=>console.log('OK')).catch(console.error)"
```

### Permission Issues

```bash
# Fix volume permissions
docker-compose exec app chown -R nodejs:nodejs /app

# Or run as root temporarily
docker-compose exec -u root app chown -R nodejs:nodejs /app
```

### Out of Disk Space

```bash
# Clean up Docker system
docker system prune -a --volumes

# Check disk usage
df -h
docker system df
```

### Performance Issues

```bash
# Check resource limits
docker stats

# Increase resources in Docker Desktop settings
# Or update docker-compose.yml with resource limits
```

## Advanced Configuration

### Using External Database

```yaml
services:
  app:
    environment:
      - POSTGRES_URL=postgresql://user:pass@external-host:5432/pharmacy
```

Then remove the `db` service.

### Adding Redis for Caching

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Adding Nginx Reverse Proxy

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

### Enable HTTPS with Let's Encrypt

Use `nginx-proxy` and `letsencrypt-nginx-proxy-companion`:

```yaml
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build image
        run: docker build -t pharmacy-inventory .
```

### GitLab CI

```yaml
build:
  stage: build
  script:
    - docker build -t pharmacy-inventory .
    - docker-compose up -d
```

## Support

For issues or questions:
- Review logs: `docker-compose logs`
- Check main [DEPLOYMENT.md](./DEPLOYMENT.md)
- Create issue in repository

## Quick Reference

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build

# Backup DB
docker-compose exec db pg_dump -U pharmacyuser pharmacy > backup.sql

# Shell access
docker-compose exec app sh
docker-compose exec db psql -U pharmacyuser pharmacy

# Status
docker-compose ps

# Resource usage
docker stats pharmacy-app pharmacy-db
```
