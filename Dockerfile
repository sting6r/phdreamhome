FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client and Build the project
RUN npx prisma generate
RUN npm run build

# Expose the port Next.js runs on
EXPOSE 3000

# Set environment to production
ENV NODE_ENV production

# Start the application using your server.js
CMD ["npm", "start"]
