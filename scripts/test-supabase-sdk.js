
const { createClient } = require('@supabase/supabase-js');

// Use the values from .env or the fallbacks in src/lib/supabase.ts
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xcovewaplqwmqisplunx.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhjb3Zld2FwbHF3bXFpc3BsdW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTY0MjQsImV4cCI6MjA4NzA5MjQyNH0.l4_PpQdkgICKADlJF2PmKh9BNwdBwXAeVyWrfBUJ0Jc";

console.log(`Testing Supabase SDK (REST) with URL: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data, error } = await supabase.from('Listing').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Supabase SDK Error:', error);
    } else {
      console.log('Supabase SDK Success! Listing count:', data, '(or null if head:true)');
    }

    // Try fetching one record
    const { data: records, error: fetchError } = await supabase.from('Listing').select('id, title').limit(1);
    if (fetchError) {
      console.error('Fetch Error:', fetchError);
    } else {
      console.log('Fetched Record:', records);
    }

  } catch (e) {
    console.error('Unexpected error:', e);
  }
}

main();
