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
              try {
                const url = new URL(process.env.DATABASE_URL);
                
                // Ensure sslmode=require for Supabase/remote connections
                if (url.hostname.includes("supabase.co") && !url.searchParams.has("sslmode")) {
                  url.searchParams.set("sslmode", "require");
                }

                // Add pgbouncer=true if using Supabase Transaction Pooler (port 6543)
                if (url.port === "6543" && !url.searchParams.has("pgbouncer")) {
                  url.searchParams.set("pgbouncer", "true");
                }
                
                // Set reasonable connection pool limits and timeouts
                if (!url.searchParams.has("connection_limit")) {
                  url.searchParams.set("connection_limit", "15");
                } else if (url.searchParams.get("connection_limit") === "1") {
                  url.searchParams.set("connection_limit", "5");
                }
                
                if (!url.searchParams.has("pool_timeout")) {
                  url.searchParams.set("pool_timeout", "30");
                }

                if (!url.searchParams.has("connect_timeout")) {
                  url.searchParams.set("connect_timeout", "30");
                }
                
                return url.toString();
              } catch (e) {
                // Fallback to basic string manipulation if URL parsing fails
                console.warn("Prisma: Failed to parse DATABASE_URL with URL API, falling back to string manipulation", e);
                let url = process.env.DATABASE_URL;
                if (url.includes("supabase.co") && !url.includes("sslmode=")) {
                  url += (url.includes("?") ? "&" : "?") + "sslmode=require";
                }
                if (url.includes(":6543") && !url.includes("pgbouncer=")) {
                  url += (url.includes("?") ? "&" : "?") + "pgbouncer=true";
                }
                return url;
              }
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
      const errorMessage = error.message || "";
      const isTransient = 
        errorMessage.includes("Connection reset by peer") || 
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes("Timed out fetching a connection from the pool") ||
        errorMessage.includes("PrismaClientInitializationError") ||
        errorMessage.includes("initialization") ||
        errorMessage.includes("connect_timeout");
      
      if (!isTransient || i === retries - 1) {
        // If it's the last retry or not transient, log it clearly
        if (i === retries - 1) {
          console.error(`Database operation failed after ${retries} attempts:`, errorMessage);
        }
        throw error;
      }
      
      console.warn(`Database operation failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`, errorMessage);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw lastError;
}