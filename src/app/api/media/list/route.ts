import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin, bucket, bucketProfile } from "@/lib/supabase";
import { getProxyImageUrl } from "@/lib/image-utils";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "").toLowerCase();
  const listBucket = scope === "profile" ? bucketProfile : bucket;
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1];
  }

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify token
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure profile bucket exists when listing from it
  if (scope === "profile") {
    try {
      await supabaseAdmin.storage.createBucket(bucketProfile, {
        public: false,
        fileSizeLimit: "5242880",
        allowedMimeTypes: ["image/*"]
      });
    } catch (e) {
      // ignore if exists or permission denied
    }
  }

  // List files from the chosen bucket
  // Limit to 100 most recent for performance
  const { data, error } = await supabaseAdmin.storage
    .from(listBucket)
    .list("", { limit: 100, offset: 0, sortBy: { column: "created_at", order: "desc" } });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to usable URLs
  const files = data.map((file) => {
    // Construct the path format expected by getProxyImageUrl and the app
    const path = `${listBucket}:${file.name}`;
    const url = getProxyImageUrl(path);
    return {
      name: file.name,
      path: path,
      url: url,
      created_at: file.created_at,
      metadata: file.metadata
    };
  });

  return NextResponse.json({ files });
}
