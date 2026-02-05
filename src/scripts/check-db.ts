
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
    console.log(`SSL: ${dbUrl.includes("sslmode=") ? "Found" : "NOT FOUND (Might be needed)"}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  
  console.log(`\nSupabase URL: ${supabaseUrl ? "Set" : "MISSING"}`);
  console.log(`Supabase Key: ${supabaseKey ? "Set" : "MISSING"}`);

  console.log("\n--- Testing Prisma ---");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl + (dbUrl.includes("supabase.co") && !dbUrl.includes("sslmode=") ? (dbUrl.includes("?") ? "&" : "?") + "sslmode=require" : "")
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
      console.log("Tip: Ensure 0.0.0.0/0 is allowed in Supabase -> Settings -> Network Restrictions.");
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
