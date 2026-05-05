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

# Set working directory
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy server code
COPY server ./server
COPY api ./api

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/build ./build

# Install serve to host the React build
RUN npm install -g serve

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
# 3000 for frontend, 5001 for backend API
EXPOSE 3000 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/test', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Create startup script
COPY --chown=nodejs:nodejs <<'EOF' /app/start.sh
#!/bin/sh
# Start backend server in background
node server/server.js &
# Start frontend server in foreground
serve -s build -l 3000
EOF

RUN chmod +x /app/start.sh

# Start both frontend and backend
CMD ["/bin/sh", "/app/start.sh"]
