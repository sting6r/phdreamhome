import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyData() {
  console.log('Verifying data in new Supabase project...');
  console.log(`URL: ${supabaseUrl}`);

  // Check Listings
  const { count: listingsCount, error: listingsError } = await supabase
    .from('Listing')
    .select('*', { count: 'exact', head: true });
  
  if (listingsError) {
    console.error('Error checking Listings:', listingsError);
  } else {
    console.log(`Listings count: ${listingsCount}`);
  }

  // Check Blogs
  const { data: blogs, error: blogsError } = await supabase
    .from('BlogPost')
    .select('*')
    .limit(5);

  if (blogsError) {
    console.error('Error checking Blogs:', blogsError);
  } else {
    console.log(`Blogs count: ${blogs?.length}`);
    blogs?.forEach(b => console.log(`- ${b.title} (coverPath: ${b.coverPath})`));
  }


  // Check Listing Images
  const { data: listingImages, error: listingImagesError } = await supabase
    .from('ListingImage')
    .select('url')
    .limit(5);

  if (listingImagesError) {
    console.error('Error checking Listing Images:', listingImagesError);
  } else {
    console.log('\nListing Images (first 5):');
    listingImages?.forEach(img => console.log(`- ${img.url}`));
  }

  // Check Blog Media
  const { data: blogMedia, error: blogMediaError } = await supabase
    .from('BlogMedia')
    .select('path, type')
    .limit(5);

  if (blogMediaError) {
    console.error('Error checking Blog Media:', blogMediaError);
  } else {
    console.log('\nBlog Media (first 5):');
    blogMedia?.forEach(media => console.log(`- [${media.type}] ${media.path}`));
  }


  // Check Storage Buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('Error checking buckets:', bucketsError);
  } else {
    console.log('\nStorage Buckets:');
    for (const bucket of buckets || []) {
      console.log(`- ${bucket.name} (public: ${bucket.public})`);
      
      // List files in root of bucket (limit 5)
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 5 });
        
      if (filesError) {
        console.error(`  Error listing files in ${bucket.name}:`, filesError);
      } else {
        if (files && files.length > 0) {
          console.log(`  Files (first 5):`);
          files.forEach(f => console.log(`    - ${f.name} (${(f.metadata?.size / 1024).toFixed(2)} KB)`));
        } else {
          console.log(`  (No files found in root)`);
        }
      }
    }
  }
}

verifyData();
