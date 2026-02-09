
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

async function diagnose() {
  console.log("=== Database Diagnosis ===");
  
  const dbUrl = process.env.DATABASE_URL || "";
  console.log(`DATABASE_URL: ${dbUrl ? (dbUrl.includes("supabase.co") ? "Supabase detected" : "Set") : "MISSING"}`);
  
  if (dbUrl) {
    const masked = dbUrl.replace(/:[^:@]+@/, ":****@");
    console.log(`URL format: ${masked.slice(0, 40)}...`);
    console.log(`Port: ${dbUrl.match(/:(\d+)/)?.[1] || "Default (5432)"}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  
  console.log(`\nSupabase URL: ${supabaseUrl ? "Set" : "MISSING"}`);
  console.log(`Supabase Key: ${supabaseKey ? "Set" : "MISSING"}`);

  console.log("\n--- Testing Prisma ---");
  
  const processedUrl = (() => {
    try {
      if (!dbUrl) return undefined;
      let urlStr = dbUrl;
      if (urlStr.includes("supabase.co") && !urlStr.includes("sslmode=")) {
        urlStr += (urlStr.includes("?") ? "&" : "?") + "sslmode=require";
      }
      if (urlStr.includes(":6543") && !urlStr.includes("pgbouncer=")) {
        urlStr += (urlStr.includes("?") ? "&" : "?") + "pgbouncer=true";
      }
      return urlStr;
    } catch (e) {
      return dbUrl;
    }
  })();

  console.log(`Using processed URL for test: ${processedUrl?.replace(/:[^:@]+@/, ":****@")}`);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: processedUrl
      }
    }
  });

  try {
    const start = Date.now();
    await prisma.$connect();
    console.log(`✅ Prisma connection successful (${Date.now() - start}ms)`);
    const count = await prisma.listing.count();
    console.log(`✅ Listing count: ${count}`);
  } catch (err: any) {
    console.error(`❌ Prisma failed: ${err.message}`);
    if (err.message.includes("Can't reach database server")) {
      console.log("Tip: Check if port 6543 is blocked or if your Supabase project is paused.");
      
      console.log("\n--- Attempting Direct Connection (Port 5432) ---");
      const directUrl = process.env.DIRECT_URL;
      if (directUrl) {
        const prismaDirect = new PrismaClient({
          datasources: { db: { url: directUrl + (directUrl.includes("?") ? "&" : "?") + "sslmode=require" } }
        });
        try {
          await prismaDirect.$connect();
          console.log("✅ Direct connection successful!");
          const count = await prismaDirect.listing.count();
          console.log(`✅ Listing count (direct): ${count}`);
        } catch (directErr: any) {
          console.error(`❌ Direct connection also failed: ${directErr.message}`);
        } finally {
          await prismaDirect.$disconnect();
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (supabaseUrl && supabaseKey) {
    console.log("\n--- Testing Supabase API ---");
    const supabase = createClient(supabaseUrl, supabaseKey);
    try {
      const start = Date.now();
      const { data, error } = await supabase.from('Listing').select('id').limit(1);
      if (error) throw error;
      console.log(`✅ Supabase API successful (${Date.now() - start}ms)`);
    } catch (err: any) {
      console.error(`❌ Supabase API failed: ${err.message}`);
    }
  }

  console.log("\n=== Diagnosis Complete ===");
}

diagnose();
