import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin, bucket, bucketVideos, bucketBlogImages, bucketBlogVideos, createSignedUrl, parseBucketSpec } from "@lib/supabase";
import { getProxyImageUrl } from "@lib/image-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const u = new URL(req.url);
  const scope = (u.searchParams.get("scope") || "").toLowerCase();
  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });
  const paths: string[] = [];
  const signedUrls: (string | null)[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const type = (file as any).type || "application/octet-stream";
    const name = `${Date.now()}_${randomBytes(6).toString("hex")}`;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const objectPath = `${name}.${ext}`;
    const isVideo = (type || "").startsWith("video/");
    const targetBucket =
      scope === "blog"
        ? (isVideo ? bucketBlogVideos : bucketBlogImages)
        : (isVideo ? bucketVideos : bucket);
    const { data, error } = await supabaseAdmin.storage.from(targetBucket).upload(objectPath, buf, { contentType: type, upsert: true });
    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const qualifiedPath = `${targetBucket}:${objectPath}`;
    paths.push(qualifiedPath);
    let url = getProxyImageUrl(qualifiedPath);
    signedUrls.push(url);
  }
  return NextResponse.json({ paths, signedUrls });
}
