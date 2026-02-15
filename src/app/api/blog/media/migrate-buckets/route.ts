import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@lib/prisma";
import { supabaseAdmin, bucket, bucketVideos, bucketBlogImages, bucketBlogVideos, createSignedUrl, parseBucketSpec } from "@lib/supabase";

export const runtime = "nodejs";

function isVideoExt(p: string) {
  const s = p.split(":").pop() || p;
  const ext = (s.split(".").pop() || "").toLowerCase();
  return ext === "mp4" || ext === "webm" || ext === "ogg";
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1] || undefined;
  }
  let userId: string | null = null;
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    userId = data.user?.id ?? null;
  }
  if (!userId && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blogs = await prisma.blogPost.findMany({
    where: userId ? { userId } : undefined,
    include: { media: true }
  });
  let moved = 0;
  let coverUpdated = 0;
  const failed: { id: string; path: string; error: string }[] = [];

  for (const blog of blogs) {
    const mediaUpdates: { id: string; oldPath: string; newPath: string }[] = [];
    for (const m of blog.media) {
      const oldPath = m.path || "";
      const { bucketName, objectPath } = parseBucketSpec(oldPath);
      const alreadyInBlogBuckets = bucketName === bucketBlogImages || bucketName === bucketBlogVideos;
      const typeVideo = (String(m.type || "")).toLowerCase() === "video" || isVideoExt(objectPath);
      const targetBucket = typeVideo ? bucketBlogVideos : bucketBlogImages;
      if (alreadyInBlogBuckets && ((typeVideo && bucketName === bucketBlogVideos) || (!typeVideo && bucketName === bucketBlogImages))) {
        continue;
      }
      const sourceBucket = bucketName || (typeVideo ? bucketVideos : bucket);
      try {
        let buf: Buffer | null = null;
        let ct: string = "application/octet-stream";
        const dl = await supabaseAdmin.storage.from(sourceBucket).download(objectPath);
        if (dl.data) {
          buf = Buffer.from(await dl.data.arrayBuffer());
          ct = (dl.data.type || ct);
        } else {
          let direct = await createSignedUrl(`${sourceBucket}:${objectPath}`);
          if (!direct) {
            try {
              const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
              if (base) {
                const pub = `${base}/storage/v1/object/public/${encodeURIComponent(sourceBucket)}/${objectPath}`;
                direct = pub;
              } else {
                const { data } = supabaseAdmin.storage.from(sourceBucket).getPublicUrl(objectPath);
                direct = data.publicUrl || null;
              }
            } catch {}
          }
          if (!direct) throw new Error("download failed");
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 10000);
          try {
            const r = await fetch(direct, { signal: controller.signal });
            if (!r.ok) throw new Error("download failed");
            buf = Buffer.from(await r.arrayBuffer());
            clearTimeout(id);
          } catch (e) {
            clearTimeout(id);
            throw e;
          }
          const ext = (objectPath.split(".").pop() || "").toLowerCase();
          ct = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "mp4" ? "video/mp4" : ext === "webm" ? "video/webm" : ext === "ogg" ? "video/ogg" : ct;
        }
        const up = await supabaseAdmin.storage.from(targetBucket).upload(objectPath, buf, { contentType: ct, upsert: true });
        if (up.error) throw new Error(up.error.message);
        if (sourceBucket !== targetBucket) {
          await supabaseAdmin.storage.from(sourceBucket).remove([objectPath]).catch(()=>{});
        }
        const newPath = `${targetBucket}:${objectPath}`;
        await prisma.blogMedia.update({ where: { id: m.id }, data: { path: newPath } });
        mediaUpdates.push({ id: m.id, oldPath, newPath });
        moved++;
      } catch (e: any) {
        failed.push({ id: m.id, path: oldPath, error: String(e?.message || e) });
      }
    }
    if (blog.coverPath) {
      const coverPath = blog.coverPath;
      const match = mediaUpdates.find(u => {
        const coverObject = parseBucketSpec(coverPath).objectPath;
        const updateObject = parseBucketSpec(u.oldPath).objectPath;
        return u.oldPath === coverPath || coverObject === updateObject;
      });
      if (match) {
        await prisma.blogPost.update({ where: { id: blog.id }, data: { coverPath: match.newPath } });
        coverUpdated++;
      } else {
        const { bucketName, objectPath } = parseBucketSpec(coverPath);
        const isImageCover = !isVideoExt(objectPath);
        if (bucketName !== bucketBlogImages && isImageCover) {
          try {
            let buf: Buffer | null = null;
            let ct: string = "image/png";
            const dl = await supabaseAdmin.storage.from(bucketName || bucket).download(objectPath);
            if (dl.data) {
              buf = Buffer.from(await dl.data.arrayBuffer());
              ct = (dl.data.type || ct);
            } else {
              let direct = await createSignedUrl(`${bucketName || bucket}:${objectPath}`);
              if (!direct) {
                try {
                  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
                  if (base) {
                    const pub = `${base}/storage/v1/object/public/${encodeURIComponent(bucketName || bucket)}/${objectPath}`;
                    direct = pub;
                  } else {
                    const { data } = supabaseAdmin.storage.from(bucketName || bucket).getPublicUrl(objectPath);
                    direct = data.publicUrl || null;
                  }
                } catch {}
              }
              if (!direct) throw new Error("download failed");
              const controller = new AbortController();
              const id = setTimeout(() => controller.abort(), 10000);
              try {
                const r = await fetch(direct, { signal: controller.signal });
                if (!r.ok) throw new Error("download failed");
                buf = Buffer.from(await r.arrayBuffer());
                clearTimeout(id);
              } catch (e) {
                clearTimeout(id);
                throw e;
              }
            }
            const up = await supabaseAdmin.storage.from(bucketBlogImages).upload(objectPath, buf, { contentType: ct, upsert: true });
            if (up.error) throw new Error(up.error.message);
            if ((bucketName || bucket) !== bucketBlogImages) {
              await supabaseAdmin.storage.from(bucketName || bucket).remove([objectPath]).catch(()=>{});
            }
            const newCover = `${bucketBlogImages}:${objectPath}`;
            await prisma.blogPost.update({ where: { id: blog.id }, data: { coverPath: newCover } });
            coverUpdated++;
          } catch (e: any) {
            failed.push({ id: blog.id, path: coverPath, error: String(e?.message || e) });
          }
        }
      }
    }
  }

  return NextResponse.json({ moved, coverUpdated, failed });
}

export async function GET(req: Request) {
  return POST(req);
}
