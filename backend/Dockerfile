# Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies; TypeScript and Prisma CLI are needed during build.
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Remove development dependencies after the build while preserving generated Prisma client.
RUN npm prune --omit=dev

# Production stage
FROM node:22-alpine AS runtime

WORKDIR /app

# Create logs directory
RUN mkdir -p logs

# Copy runtime files from the builder.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Run Node as PID 1 so Kubernetes signals reach the graceful-shutdown coordinator.
CMD ["node", "dist/index.js"]
