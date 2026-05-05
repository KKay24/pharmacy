# Quick Start Guide

Get your Pharmacy Inventory Management System up and running in minutes!

## Choose Your Deployment Method

### 🚀 Fastest: Vercel (5 minutes)

**Perfect for**: Production deployments, demos, testing

1. **Get a PostgreSQL database** (choose one):
   - [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (Recommended)
   - [Neon](https://neon.tech) (Generous free tier)
   - [Supabase](https://supabase.com) (Full featured)

2. **Get connection string** (format):
   ```
   postgresql://username:password@host:5432/database
   ```

3. **Deploy**:
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Login
   vercel login
   
   # Deploy
   vercel --prod
   ```

4. **Add environment variable**:
   ```bash
   vercel env add POSTGRES_URL
   # Paste your connection string when prompted
   ```

5. **Access your app**:
   - Visit the URL provided by Vercel
   - Login with: `admin` / `1234`
   - **IMPORTANT**: Change password immediately!

✅ **Done!** Your app is live.

---

### 🐳 Easiest: Docker (15 minutes)

**Perfect for**: Local development, self-hosting, full control

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set a secure password:
   ```bash
   POSTGRES_PASSWORD=your_secure_password_here
   ```

2. **Start everything**:
   ```bash
   docker-compose up -d
   ```

3. **Check status**:
   ```bash
   docker-compose ps
   ```
   
   Both services should show "Up" and "healthy"

4. **Access your app**:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5001/api/test
   - Login: `admin` / `1234`

5. **View logs** (if needed):
   ```bash
   docker-compose logs -f
   ```

✅ **Done!** Your app is running locally.

**Useful commands**:
```bash
# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Backup database
docker-compose exec db pg_dump -U pharmacyuser pharmacy > backup.sql
```

---

### 💻 Local Development (10 minutes)

**Perfect for**: Development, testing changes

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm start
   ```

3. **Access your app**:
   - Frontend: http://localhost:3000
   - Uses SQLite (no database setup needed!)
   - Login: `admin` / `1234`

✅ **Done!** Development server running.

**Note**: This uses SQLite and is suitable for development only.

---

## After First Login

### 🔐 Critical: Change Default Password

1. Login with default credentials
2. Navigate to user settings (add this feature if not present)
3. Change password immediately

### 🧪 Test Core Features

- [ ] Dashboard loads
- [ ] Add a test medicine
- [ ] Add a batch to the medicine
- [ ] Create a test sale
- [ ] View reports
- [ ] Add a customer
- [ ] Upload a prescription

### 📊 Add Your Data

1. **Add Medicines**: Navigate to Inventory → Add Medicine
2. **Add Batches**: For each medicine, add batch info (expiry, quantity, prices)
3. **Add Customers**: Navigate to Customers → Add Customer
4. **Make Sales**: Use POS to record transactions

---

## Troubleshooting

### Vercel: "API not found" error

**Solution**:
```bash
# Check environment variable
vercel env ls

# Add if missing
vercel env add POSTGRES_URL
```

### Docker: Containers won't start

**Solution**:
```bash
# Check logs
docker-compose logs

# Common fix: Remove and recreate
docker-compose down -v
docker-compose up -d
```

### Local: Port 3000 already in use

**Solution**:
```bash
# Kill process on port 3000
# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database connection errors

**Solution**:
- Verify connection string format
- Check database is accessible
- Ensure SSL mode: `?sslmode=require` for production
- Test connection string with `psql` or database client

---

## Next Steps

### Production Checklist
- [ ] Change admin password
- [ ] Set up regular database backups
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring (optional)
- [ ] Review security settings

### Learn More
- **[README.md](./README.md)** - Full project documentation
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Detailed deployment guide
- **[DEPLOYMENT-SUMMARY.md](./docs/DEPLOYMENT-SUMMARY.md)** - Quick reference
- **[DOCKER.md](./docs/DOCKER.md)** - Docker operations
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture

---

## Quick Command Reference

### Vercel
```bash
vercel                    # Deploy to preview
vercel --prod            # Deploy to production
vercel logs              # View logs
vercel env ls            # List environment variables
vercel env add NAME      # Add environment variable
```

### Docker
```bash
docker-compose up -d     # Start in background
docker-compose down      # Stop containers
docker-compose ps        # Show status
docker-compose logs -f   # Follow logs
docker-compose restart   # Restart all services
```

### NPM Scripts
```bash
npm start                # Development mode
npm run build            # Production build
npm test                 # Run tests
npm run serve            # Build and serve locally
npm run docker:up        # Start Docker
npm run docker:down      # Stop Docker
npm run docker:logs      # View Docker logs
```

### Deploy Script
```bash
# Make executable (first time only)
chmod +x scripts/deploy.sh

# Commands
./scripts/deploy.sh docker        # Docker deployment
./scripts/deploy.sh vercel        # Vercel deployment
./scripts/deploy.sh test-build    # Test build locally
./scripts/deploy.sh backup-db     # Backup database
./scripts/deploy.sh help          # Show all commands
```

---

## Default Access

**Login Credentials**:
```
Username: admin
Password: 1234
```

**⚠️ SECURITY WARNING**: Change these credentials immediately after first login!

---

## Support

### Common Resources
- Review logs for errors
- Check database connection
- Verify environment variables
- Test API endpoints independently

### Documentation
- [DEPLOYMENT-CHECKLIST.md](./docs/DEPLOYMENT-CHECKLIST.md) - Detailed checklist
- [TROUBLESHOOTING](./docs/DEPLOYMENT.md#troubleshooting) - Common issues

### Create an Issue
If you encounter problems not covered here, create an issue in the repository with:
- Deployment method (Vercel/Docker/Local)
- Error messages
- Steps to reproduce
- System information

---

**Happy deploying! 🎉**

Need more details? Check the [full deployment guide](./docs/DEPLOYMENT.md).
