# Multi-stage build for optimized production image

# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/pharmacy-inventory

# Copy package files
COPY pharmacy-inventory/package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY pharmacy-inventory/public ./public
COPY pharmacy-inventory/src ./src

# Build React app
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install backend production dependencies
COPY pharmacy-backend/server/package*.json ./pharmacy-backend/server/
RUN cd pharmacy-backend/server && npm ci --only=production && npm cache clean --force

# Copy backend code
COPY pharmacy-backend/server ./pharmacy-backend/server

# Copy built frontend from previous stage (preserves relative path for express.static)
COPY --from=frontend-builder /app/pharmacy-inventory/build ./pharmacy-inventory/build

# Create startup script
COPY <<'EOF' /app/start.sh
#!/bin/sh
# Navigate to backend directory and start the server
cd /app/pharmacy-backend/server
node src/main.js
EOF

RUN chmod +x /app/start.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start server
CMD ["/bin/sh", "/app/start.sh"]
