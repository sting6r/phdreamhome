# Force redeploy to refresh settings
FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
# Skip prisma generate during npm ci because schema isn't copied yet
RUN npm ci --ignore-scripts

# Copy the rest of the application
COPY . .

# Now generate Prisma Client and Build
RUN npx prisma generate
RUN npm run build

# Expose the port (Railway will use this or the PORT env var)
# We don't hardcode it here to allow Railway to inject PORT
# EXPOSE 3000 

# Set environment to production
ENV NODE_ENV production
ENV PORT 3005

# Start the application using your server.js
CMD ["node", "server.js"]
