-- Run this in your Supabase Dashboard > SQL Editor to fix permission issues

-- 1. Grant usage on public schema to service_role and anon/authenticated roles
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Grant all privileges on all tables in public schema to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- 3. Ensure Listing table exists and is accessible
-- (This is just a check, the grants above should cover it)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Listing" TO service_role;
GRANT SELECT ON TABLE "Listing" TO anon;
GRANT SELECT ON TABLE "Listing" TO authenticated;

-- 4. Verify RLS policies (Optional - usually service_role bypasses RLS)
-- ALTER TABLE "Listing" ENABLE ROW LEVEL SECURITY;

-- 5. Fix ownership if necessary
-- ALTER SCHEMA public OWNER TO postgres;
