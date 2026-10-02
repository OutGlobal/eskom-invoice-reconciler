# ==============================================================================
# Production Dockerfile — Eskom Management Platform & Bill Balancer
# Zero-Drift Deterministic Utility Reconciliation Engine
# ==============================================================================

# Stage 1: Build Dependencies & Production Artifacts
FROM node:20-alpine AS builder

WORKDIR /app

# Install build essentials if needed for native modules
RUN apk add --no-cache python3 make g++

# Copy package manifests for optimal caching
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy source tree and configs
COPY . .

# Compile TypeScript and generate production server & client bundle
RUN npx tsc --noEmit
RUN npm run build

# Prune dev dependencies for production runtime
RUN npm prune --production

# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install dumb-init for graceful signal termination (SIGTERM, SIGINT)
RUN apk add --no-cache dumb-init

# Security: Create non-root system user and group
RUN addgroup -S -g 1001 eskom && \
    adduser -S -u 1001 -G eskom eskom

# Environment configuration
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Copy runtime assets and dependencies from builder
COPY --from=builder --chown=eskom:eskom /app/package.json ./package.json
COPY --from=builder --chown=eskom:eskom /app/node_modules ./node_modules
COPY --from=builder --chown=eskom:eskom /app/public ./public
COPY --from=builder --chown=eskom:eskom /app/.output ./.output

# Switch to unprivileged non-root user
USER eskom

# Health check liveness & readiness probe for Kubernetes / Docker / Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

EXPOSE 3000

# Graceful signal handling via dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", ".output/server/index.mjs"]
