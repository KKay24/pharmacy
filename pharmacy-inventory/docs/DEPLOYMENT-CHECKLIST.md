# Deployment Checklist

Use this checklist to ensure a smooth deployment process for the Pharmacy Inventory Management System.

## Pre-Deployment Checklist

### Code Preparation
- [ ] All code changes committed to git
- [ ] All tests passing (`npm test`)
- [ ] Build completes successfully (`npm run build`)
- [ ] No console errors in development mode
- [ ] Code reviewed and approved (if team environment)
- [ ] Version number updated in `package.json` (if applicable)

### Security Review
- [ ] Environment variables configured (no hardcoded secrets)
- [ ] Default admin password will be changed after deployment
- [ ] Database credentials are secure
- [ ] CORS settings are properly configured
- [ ] SSL/HTTPS enabled for production
- [ ] API rate limiting considered (if high traffic expected)
- [ ] Sensitive data not in git repository
- [ ] `.env` file in `.gitignore`

### Database Preparation
- [ ] Database provider selected (PostgreSQL recommended)
- [ ] Database created and accessible
- [ ] Connection string tested locally
- [ ] Backup strategy planned
- [ ] Database migrations tested (if applicable)
- [ ] Understand data persistence requirements

### Documentation
- [ ] README.md reviewed and updated
- [ ] DEPLOYMENT.md reviewed
- [ ] Environment variables documented
- [ ] API endpoints documented (if needed)
- [ ] Architecture decisions documented (if needed)

## Vercel Deployment Checklist

### Before Deployment
- [ ] Vercel account created
- [ ] PostgreSQL database provisioned
  - [ ] Vercel Postgres, OR
  - [ ] Neon, Supabase, Railway, or other provider
- [ ] Database connection string obtained
- [ ] Repository pushed to GitHub/GitLab/Bitbucket

### During Deployment
- [ ] Project imported to Vercel
- [ ] Framework preset: Create React App
- [ ] Build command: `npm run build`
- [ ] Output directory: `build`
- [ ] Environment variable added: `POSTGRES_URL`
- [ ] Deployment successful
- [ ] Build logs reviewed (no errors)

### After Deployment
- [ ] Application accessible at Vercel URL
- [ ] Test API endpoint: `https://your-app.vercel.app/api/test`
- [ ] Login functionality works
- [ ] Database connection successful
- [ ] All pages load correctly
- [ ] Navigation works (React Router)
- [ ] API calls successful from frontend
- [ ] Default admin user created in database
- [ ] Admin password changed from default
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active (automatic on Vercel)
- [ ] Performance tested (acceptable load times)

### Monitoring Setup
- [ ] Vercel Analytics enabled (optional)
- [ ] Error tracking configured (optional - Sentry, etc.)
- [ ] Uptime monitoring (optional - UptimeRobot, etc.)
- [ ] Database monitoring configured
- [ ] Backup schedule confirmed

## Docker Deployment Checklist

### Before Deployment
- [ ] Docker installed on host system
- [ ] Docker Compose installed
- [ ] Server/VPS provisioned and accessible
- [ ] Required ports available (3000, 5001, 5432)
- [ ] `.env` file created with secure passwords

### During Deployment
- [ ] Repository cloned to server
- [ ] `.env` file configured
- [ ] Docker images built: `docker-compose build`
- [ ] Containers started: `docker-compose up -d`
- [ ] Health checks passing: `docker-compose ps`
- [ ] Logs reviewed: `docker-compose logs`

### After Deployment
- [ ] Application accessible
- [ ] Database persistent (data survives restart)
- [ ] Frontend accessible on port 3000
- [ ] Backend API accessible on port 5001
- [ ] Database accessible (if needed externally)
- [ ] Container auto-restart configured
- [ ] Reverse proxy configured (Nginx - if applicable)
- [ ] SSL certificate installed (if applicable)
- [ ] Firewall configured
- [ ] Backup script created and scheduled
- [ ] Update procedure documented

### Docker Production Considerations
- [ ] Resource limits set (CPU, memory)
- [ ] Log rotation configured
- [ ] Monitoring set up (Prometheus, Grafana - optional)
- [ ] Secrets management configured
- [ ] Non-root user in container
- [ ] Health checks configured
- [ ] Restart policy set
- [ ] Network security configured

## Traditional Server Deployment Checklist

### Server Setup
- [ ] Server/VPS provisioned
- [ ] Ubuntu/Linux installed and updated
- [ ] Node.js 16+ installed
- [ ] PostgreSQL installed and configured
- [ ] PM2 installed globally
- [ ] Nginx installed
- [ ] Firewall configured (UFW or similar)
- [ ] SSH keys configured
- [ ] Swap space configured (if low RAM)

### Application Setup
- [ ] Repository cloned to server
- [ ] Dependencies installed: `npm install`
- [ ] `.env` file created and configured
- [ ] React app built: `npm run build`
- [ ] Database created and user configured
- [ ] PM2 ecosystem file configured
- [ ] Application started with PM2
- [ ] PM2 save and startup configured

### Nginx Configuration
- [ ] Nginx config file created
- [ ] Proxy settings configured
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] SSL configured in Nginx
- [ ] HTTP to HTTPS redirect configured
- [ ] Nginx config tested: `nginx -t`
- [ ] Nginx restarted
- [ ] Domain DNS configured

### Post-Deployment
- [ ] Application accessible via domain
- [ ] HTTPS working
- [ ] API endpoints accessible
- [ ] Database connection working
- [ ] Default admin password changed
- [ ] PM2 logs checked: `pm2 logs`
- [ ] Nginx logs checked
- [ ] Auto-restart tested (reboot server)
- [ ] Backup script created and scheduled
- [ ] Monitoring configured (optional)

## Post-Deployment Verification

### Functional Testing
- [ ] User registration/login works
- [ ] Dashboard loads with correct data
- [ ] Inventory operations work (add, edit, delete)
- [ ] POS functionality works
- [ ] Prescriptions can be created/viewed
- [ ] Reports generate correctly
- [ ] Customer management works
- [ ] Sales transactions record properly
- [ ] Search functionality works
- [ ] Export functionality works (Excel, PDF)
- [ ] All navigation links work
- [ ] Mobile responsive design verified

### Performance Testing
- [ ] Page load time acceptable (<3 seconds)
- [ ] API response time acceptable (<1 second)
- [ ] Database queries optimized
- [ ] No memory leaks (monitor over time)
- [ ] Concurrent users tested (if expected load known)

### Security Verification
- [ ] HTTPS enabled and working
- [ ] Default credentials changed
- [ ] Environment variables not exposed
- [ ] API endpoints secured appropriately
- [ ] SQL injection tested (basic sanity check)
- [ ] XSS vulnerabilities checked
- [ ] CORS configured correctly
- [ ] Security headers configured (if using Nginx)

## Ongoing Maintenance Checklist

### Daily
- [ ] Check application is accessible
- [ ] Review error logs (if configured)
- [ ] Monitor server resources (if metrics available)

### Weekly
- [ ] Review application logs
- [ ] Check database size/growth
- [ ] Verify backups are running
- [ ] Test backup restoration (monthly recommended)

### Monthly
- [ ] Review and update dependencies: `npm audit`
- [ ] Check for security updates
- [ ] Review and clear old logs
- [ ] Performance optimization review
- [ ] Test disaster recovery procedure

### Quarterly
- [ ] Review and update documentation
- [ ] Security audit
- [ ] Load testing (if high traffic)
- [ ] Database optimization (vacuum, reindex)
- [ ] Review and update deployment process

## Rollback Plan

### If Deployment Fails
- [ ] Keep previous version accessible
- [ ] Document rollback procedure:
  - Vercel: Revert to previous deployment in dashboard
  - Docker: `docker-compose down && git checkout previous-tag && docker-compose up -d`
  - Traditional: `pm2 restart` with previous code
- [ ] Database rollback plan (if schema changed)
- [ ] Communication plan for users (if downtime)

### Rollback Steps
1. Stop new deployment
2. Revert code to previous stable version
3. Restore database if needed
4. Restart services
5. Verify application works
6. Investigate and fix issues
7. Re-deploy when ready

## Support and Documentation

- [ ] Support contact information shared with users
- [ ] User documentation provided (if needed)
- [ ] Training scheduled (if applicable)
- [ ] Incident response plan documented
- [ ] Team access and credentials documented securely

## Sign-Off

- [ ] Deployment completed by: ________________
- [ ] Date: ________________
- [ ] Verified by: ________________ (if applicable)
- [ ] Issues encountered: ________________
- [ ] Resolution notes: ________________

---

**Remember**: Always test in a staging environment before deploying to production!

For detailed instructions, refer to:
- [README.md](../README.md) - Project overview
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment instructions
- [DOCKER.md](./DOCKER.md) - Docker-specific guide
