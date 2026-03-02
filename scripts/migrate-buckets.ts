import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

function clean(v?: string) {
  if (!v) return undefined;
  const s = v.trim();
  return s.replace(/^['"`]/, "").replace(/['"`]$/, "");
}

const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || "https://xcovewaplqwmqisplunx.supabase.co";
const supabaseServiceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const MIGRATIONS = [
  { from: "blog image", to: "blogimage", public: true },
  { from: "blog video", to: "blogvideo", public: true }
];

async function listAllFiles(bucket: string, path: string = ""): Promise<any[]> {
  const { data, error } = await supabase.storage.from(bucket).list(path);
  if (error) {
    console.error(`Error listing ${bucket}/${path}:`, error);
    return [];
  }
  
  let allFiles: any[] = [];
  
  for (const item of data || []) {
    if (item.id === null) {
      // It's a folder
      const subPath = path ? `${path}/${item.name}` : item.name;
      // console.log(`Found folder: ${subPath}`);
      const subFiles = await listAllFiles(bucket, subPath);
      allFiles = allFiles.concat(subFiles);
    } else {
      // It's a file
      if (item.name !== ".emptyFolderPlaceholder") {
        allFiles.push({ ...item, fullPath: path ? `${path}/${item.name}` : item.name });
      }
    }
  }
  return allFiles;
}

async function main() {
  for (const m of MIGRATIONS) {
    console.log(`\nMigrating from '${m.from}' to '${m.to}'...`);

    // 1. Create new bucket if needed
    const { error: createError } = await supabase.storage.createBucket(m.to, {
      public: m.public,
      fileSizeLimit: m.to === "blogvideo" ? 52428800 : 5242880, // 50MB video, 5MB image
      allowedMimeTypes: m.to === "blogvideo" ? ["video/*"] : ["image/*"]
    });
    
    if (createError) {
      if (createError.message.includes("already exists")) {
        console.log(`Bucket '${m.to}' already exists.`);
      } else {
        console.error(`Error creating bucket ${m.to}:`, createError);
        continue;
      }
    } else {
      console.log(`Bucket '${m.to}' created.`);
    }

    // 2. List files
    console.log("Scanning files...");
    const files = await listAllFiles(m.from);
    
    if (files.length === 0) {
      console.log(`No files found in '${m.from}'.`);
      continue;
    }

    console.log(`Found ${files.length} files in '${m.from}'.`);

    // 3. Move files
    for (const file of files) {
      const filePath = file.fullPath;
      console.log(`Processing ${filePath}...`);
      
      // Download
      const { data: blob, error: dlError } = await supabase.storage.from(m.from).download(filePath);
      if (dlError) {
        console.error(`  Failed to download ${filePath}:`, dlError);
        continue;
      }

      // Upload
      const { error: ulError } = await supabase.storage.from(m.to).upload(filePath, blob, {
        contentType: file.metadata?.mimetype,
        upsert: true
      });

      if (ulError) {
        console.error(`  Failed to upload ${filePath} to ${m.to}:`, ulError);
        continue;
      }

      console.log(`  Copied to ${m.to}.`);
      
      // Delete from old bucket (User requested "move")
      const { error: delError } = await supabase.storage.from(m.from).remove([filePath]);
      if (delError) {
        console.error(`  Failed to delete ${filePath} from old bucket:`, delError);
      } else {
        console.log(`  Deleted from ${m.from}.`);
      }
    }
  }
}

main();
