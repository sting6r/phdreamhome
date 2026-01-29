import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";
import { cookies } from "next/headers";
import { supabaseAdmin, bucket, bucketVideos, createSignedUrl } from "@lib/supabase";
export const runtime = "nodejs";

function isVideoPath(p: string) {
  const s = p.split(":").pop() || p;
  return /\.(mp4|webm|ogg)$/i.test(s);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1];
  }
  let userId: string | null = null;
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    userId = data.user?.id ?? null;
  }
  if (!userId && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const images = await prisma.listingImage.findMany(userId ? { where: { listing: { userId } } } : undefined);
  let moved = 0;
  const failed: { id: string; url: string; error: string }[] = [];
  for (const img of images) {
    const url = img.url || "";
    if (url.includes(":")) continue;
    if (!isVideoPath(url)) continue;
    try {
      let buf: Buffer | null = null;
      const dl = await supabaseAdmin.storage.from(bucket).download(url);
      if (dl.data) {
        buf = Buffer.from(await dl.data.arrayBuffer());
      } else {
        const signed = await createSignedUrl(url);
        if (!signed) throw new Error("download failed");
        const r = await fetch(signed);
        if (!r.ok) throw new Error("download failed");
        const ab = await r.arrayBuffer();
        buf = Buffer.from(ab);
      }
      const ext = (url.split(".").pop() || "").toLowerCase();
      const ct = ext === "mp4" ? "video/mp4" : ext === "webm" ? "video/webm" : ext === "ogg" ? "video/ogg" : "application/octet-stream";
      const up = await supabaseAdmin.storage.from(bucketVideos).upload(url, buf, { contentType: ct, upsert: true });
      if (up.error) throw new Error(up.error.message);
      await supabaseAdmin.storage.from(bucket).remove([url]);
      await prisma.listingImage.update({ where: { id: img.id }, data: { url: `${bucketVideos}:${url}` } });
      moved++;
    } catch (e: any) {
      failed.push({ id: img.id, url, error: String(e?.message || e) });
    }
  }
  return NextResponse.json({ moved, failed });
}
