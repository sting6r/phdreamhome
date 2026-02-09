import { prisma } from "../lib/prisma";
import { supabaseAdmin } from "../lib/supabase";

async function checkConnections() {
  console.log("--- Database Connectivity Check ---");

  // Check Prisma (Railway/External Postgres)
  try {
    console.log("⏳ Testing Prisma connection...");
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log(`✅ Prisma connection successful (${Date.now() - start}ms)`);
  } catch (err: any) {
    console.error("❌ Prisma connection failed:");
    console.error(`   ${err.message}`);
  }

  // Check Supabase Admin
  try {
    console.log("\n⏳ Testing Supabase connection...");
    const start = Date.now();
    const { data, error } = await supabaseAdmin.from("Inquiry").select("id").limit(1);
    if (error) throw error;
    console.log(`✅ Supabase connection successful (${Date.now() - start}ms)`);
  } catch (err: any) {
    console.error("❌ Supabase connection failed:");
    console.error(`   ${err.message}`);
  }
}

checkConnections()
  .catch(err => console.error("Script error:", err))
  .finally(() => process.exit());