# Multi-stage build for optimized production image

# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY public ./public
COPY src ./src

# Build React app
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /app

# Render expects the web process to bind to a single port.
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy server code
COPY server ./server
COPY api ./api

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/build ./build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the single web port used by the fallback proxy server
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/test', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Create startup script
COPY --chown=nodejs:nodejs <<'EOF' /app/start.sh
#!/bin/sh
# Start the hybrid server, which either boots the canonical backend
# or serves the built frontend and proxies /api traffic.
node server/server.js
EOF

RUN chmod +x /app/start.sh

# Start the web service
CMD ["/bin/sh", "/app/start.sh"]
