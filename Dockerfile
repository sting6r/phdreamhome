# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# Copy prisma schema before npm ci because postinstall script (prisma generate) needs it
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate prisma client again just to be safe with the full source
RUN npm run prisma:generate
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
# Install runtime dependencies for Prisma and Python
RUN apk add --no-cache openssl libc6-compat python3 py3-pip py3-virtualenv

WORKDIR /app
ENV NODE_ENV=production

# Create a non-privileged user to run the app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/ai-agent ./ai-agent

# Set up Python virtual environment for the AI Agent
RUN python3 -m venv /app/ai-agent/.venv
RUN /app/ai-agent/.venv/bin/pip install --no-cache-dir -r /app/ai-agent/requirements.txt
RUN chown -R nextjs:nodejs /app/ai-agent/.venv

# Use standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create a start script to run both Next.js and the Python agent
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
echo "Starting PhDreamHome Services..."
# Start the Python agent on internal port 8001
cd /app/ai-agent && PORT=8001 /app/ai-agent/.venv/bin/python agent_api.py &
# Wait a bit for the agent to initialize
sleep 2
# Start Next.js using the standalone server
cd /app && node server.js
EOF
RUN chmod +x /app/start.sh
RUN chown nextjs:nodejs /app/start.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start both services using the start script
CMD ["sh", "/app/start.sh"]
