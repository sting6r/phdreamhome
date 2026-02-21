import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load env vars
dotenv.config();

const prisma = new PrismaClient();

// Re-implement basic helpers to avoid importing from src/lib and dealing with aliases/next-specifics
function clean(v?: string) {
  if (!v) return undefined;
  const s = v.trim();
  return s.replace(/^['"`]/, "").replace(/['"`]$/, "");
}

const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || clean(process.env.SUPABASE_URL) || "https://xcovewaplqwmqisplunx.supabase.co";
const supabaseServiceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY) || clean(process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY);
const bucket = clean(process.env.SUPABASE_BUCKET) || "images";

if (!supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

function parseBucketSpec(p: string) {
  // Handle full Supabase Storage URLs
  if (p.startsWith("http://") || p.startsWith("https://")) {
    const storageMatch = p.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (storageMatch) {
      const b = decodeURIComponent(storageMatch[1]);
      const q = storageMatch[2].split("?")[0]; // Remove query params
      return { bucketName: b, objectPath: decodeURIComponent(q) };
    }
    return { bucketName: "", objectPath: p };
  }

  const i = p.indexOf(":");
  if (i > -1) {
    const b = p.slice(0, i).trim();
    const q = p.slice(i + 1).trim();
    return { bucketName: b || bucket, objectPath: q };
  }
  return { bucketName: bucket, objectPath: p };
}

async function main() {
  console.log("Starting image migration...");
  console.log(`Target Bucket: ${bucket}`);

  const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
  if (bucketError) {
      console.error("Error listing buckets:", bucketError);
  } else {
      console.log("Available buckets:", buckets.map(b => b.name).join(", "));
  }
  
  const listings = await prisma.listing.findMany({
    include: { images: true }
  });

  console.log(`Found ${listings.length} listings.`);
  let movedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const listing of listings) {
    if (!listing.images.length) continue;

    const propertyName = listing.title;
    if (!propertyName) {
        console.warn(`Skipping listing ${listing.id}: No title`);
        continue;
    }

    const folder = propertyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    
    if (!folder) {
        console.warn(`Skipping listing ${listing.id}: Invalid folder name from title "${listing.title}"`);
        continue;
    }

    // console.log(`Processing listing: ${listing.title} -> folder: ${folder}`);

    for (const image of listing.images) {
      const { bucketName, objectPath } = parseBucketSpec(image.url);
      
      // Only migrate if it's in the main images bucket
      if (bucketName !== bucket) {
          console.log(`Skipping image ${image.id}: Bucket '${bucketName}' != '${bucket}'`);
          skippedCount++;
          continue;
      }

      // Check if already in folder
      if (objectPath.startsWith(`${folder}/`)) {
        //   console.log(`Skipping image ${image.id}: Already in correct folder`);
          skippedCount++;
          continue;
      }

      const fileName = objectPath.split('/').pop();
      if (!fileName) {
          skippedCount++;
          continue;
      }
      
      const newObjectPath = `${folder}/${fileName}`;
      const newUrl = `${bucket}:${newObjectPath}`;

      console.log(`Moving ${objectPath} -> ${newObjectPath}`);

      try {
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .move(objectPath, newObjectPath);

        if (error) {
           console.error(`Failed to move image ${image.id} (${objectPath}): ${error.message}`);
           errorCount++;
           continue;
        }

        // Update DB
        await prisma.listingImage.update({
            where: { id: image.id },
            data: { url: newUrl }
        });
        
        console.log(`Updated DB for image ${image.id}`);
        movedCount++;

      } catch (err: any) {
          console.error(`Error processing image ${image.id}:`, err);
          errorCount++;
      }
    }
  }
  
  console.log("Migration complete.");
  console.log(`Moved: ${movedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
