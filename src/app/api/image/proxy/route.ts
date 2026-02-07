import { NextResponse } from "next/server";
import { createSignedUrl, parseBucketSpec, supabasePublic, supabaseAdmin } from "@lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function guessContentType(path: string, fallback = "application/octet-stream") {
  const ext = (path.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "ogg") return "video/ogg";
  return fallback;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "";
    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

    // Handle absolute URLs (like Google Avatar URLs) directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s timeout
        const response = await fetch(path, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const buffer = await response.arrayBuffer();
          return new Response(buffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } else {
          console.warn(`External image fetch failed with status ${response.status}: ${path}`);
          // Redirect to the original URL as a fallback if proxy fails
          return NextResponse.redirect(path);
        }
      } catch (e) {
        console.error(`Proxy fetch error for external URL ${path}:`, e);
        return NextResponse.redirect(path);
      }
    }

    const { bucketName, objectPath } = parseBucketSpec(path);
    let buf: Buffer | null = null;
    let ct: string | null = null;
    const bucket = process.env.SUPABASE_DEFAULT_BUCKET || "default";
    try {
      const { data, error } = await supabaseAdmin.storage.from(bucketName).download(objectPath);
      if (error) throw error;
      if (data) {
        buf = Buffer.from(await data.arrayBuffer());
        ct = data.type || null;
      }
    } catch (e) {
      console.error(`Proxy download error for ${path}:`, e);
    }

    // Last resort: try default bucket if not already tried
    if (!buf && bucketName !== bucket) {
      try {
        const { data } = await supabaseAdmin.storage.from(bucket).download(objectPath);
        if (data) {
          buf = Buffer.from(await data.arrayBuffer());
          ct = data.type || null;
        }
      } catch {}
    }

    if (!buf) {
      let token: string | null = null;
      try {
        const h = req.headers as Headers;
        const a = h.get("authorization") || "";
        const m = a.match(/^Bearer\s+(.+)$/i);
        token = m?.[1] || null;
      } catch {}
      if (!token) {
        try {
          const c = await (await import("next/headers")).cookies();
          token = c.get("sb-access-token")?.value || null;
        } catch {}
      }
      if (token) {
        const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/,"");
        if (base) {
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);
            const r = await fetch(`${base}/storage/v1/object/authenticated/${encodeURIComponent(bucketName)}/${encodeURIComponent(objectPath)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
            clearTimeout(id);
            if (r.ok) {
              buf = Buffer.from(await r.arrayBuffer());
              ct = r.headers.get("content-type");
            } else {
              // fallback to public if authenticated fails
              const controller2 = new AbortController();
              const id2 = setTimeout(() => controller2.abort(), 5000);
              const r2 = await fetch(`${base}/storage/v1/object/public/${encodeURIComponent(bucketName)}/${encodeURIComponent(objectPath)}`, { cache: "no-store", signal: controller2.signal });
              clearTimeout(id2);
              if (r2.ok) {
                buf = Buffer.from(await r2.arrayBuffer());
                ct = r2.headers.get("content-type");
              }
            }
          } catch (e) {
            console.error("Authenticated fetch error/timeout:", e);
          }
        }
      }
    }
    if (!buf) {
      let direct: string | null = null;
      try {
        const { data } = supabasePublic.storage.from(bucketName).getPublicUrl(objectPath);
        direct = data.publicUrl || null;
      } catch {}
      if (!direct) direct = await createSignedUrl(path);
      if (!direct) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      try {
        const r = await fetch(direct, { cache: "no-store", signal: controller.signal });
        clearTimeout(id);
        if (!r.ok) return NextResponse.json({ error: "Not found" }, { status: r.status });
        buf = Buffer.from(await r.arrayBuffer());
        ct = r.headers.get("content-type");
      } catch (e) {
        return NextResponse.json({ error: "Upstream timeout" }, { status: 504 });
      }
    }
    const type = ct || guessContentType(objectPath);
    const headers = new Headers();
    headers.set("Content-Type", type);
    headers.set("Cache-Control", "public, max-age=60");
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch (error: any) {
    console.error("Image proxy error:", error);
    return NextResponse.json({ error: "Failed to load image" }, { status: 500 });
  }
}
