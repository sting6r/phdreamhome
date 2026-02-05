import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: (() => {
              let url = process.env.DATABASE_URL;
              
              // Ensure sslmode=require for Supabase/remote connections
              if (url.includes("supabase.co") && !url.includes("sslmode=")) {
                url += (url.includes("?") ? "&" : "?") + "sslmode=require";
              }

              // Add pgbouncer=true if using Supabase Transaction Pooler (port 6543)
              // This is critical for Prisma to work correctly with transaction mode pooling
              if (url.includes(":6543") && !url.includes("pgbouncer=")) {
                url += (url.includes("?") ? "&" : "?") + "pgbouncer=true";
              }
              
              // Ensure connection_limit and pool_timeout are set
              // Increased connect_timeout to handle slow network handshakes
              if (!url.includes("connection_limit")) {
                url += (url.includes("?") ? "&" : "?") + "connection_limit=10&pool_timeout=30&connect_timeout=15";
              }
              
              return url;
            })(),
          },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Executes a database operation with retry logic to handle transient connection errors
 * like "Connection reset by peer" or "Database is starting up".
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isTransient = 
        error.message?.includes("Connection reset by peer") || 
        error.message?.includes("Can't reach database server") ||
        error.message?.includes("Timed out fetching a connection from the pool");
      
      if (!isTransient || i === retries - 1) throw error;
      
      console.warn(`Database operation failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`, error.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw lastError;
}