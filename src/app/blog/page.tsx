import Image from "next/image";
import Link from "next/link";
import MainFooterCards from "../../components/MainFooterCards";
import { cookies, headers } from "next/headers";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Real Estate Blog & News | PhDreamHome",
  description: "Stay updated with the latest real estate trends, tips, and news in the Philippines. Expert advice for buyers, sellers, and investors.",
  keywords: ["Philippines real estate blog", "property investment tips", "home buying guide", "real estate news"],
  openGraph: {
    title: "Real Estate Blog & News | PhDreamHome",
    description: "Stay updated with the latest real estate trends, tips, and news in the Philippines.",
    url: "https://www.phdreamhome.com/blog",
    siteName: "PhDreamHome",
    type: "website",
  },
  alternates: {
    canonical: "https://www.phdreamhome.com/blog",
  }
};

type BlogMedia = { path: string; type: "image" | "video"; url: string | null; title?: string | null; subtitle?: string | null; description?: string | null };
type BlogPost = { id: string; title: string; description: string; author?: string | null; displayDate?: string | null; category?: string | null; coverPath: string | null; coverUrl: string | null; media: BlogMedia[]; createdAt: number | string | Date; featured?: boolean };

async function fetchBlogsPublic(): Promise<BlogPost[]> {
  try {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") || "http";
    if (!host) return [];
    const r = await fetch(`${proto}://${host}/api/blog`, { cache: "no-store" });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      console.error("Blog page public fetch parse error:", r.status, text.slice(0, 200));
      return [];
    }
    const pubs = (j.blogs || []) as BlogPost[];
    return Array.isArray(pubs) ? pubs : [];
  } catch (e) {
    console.error("Blog page public fetch error:", e);
    return [];
  }
}
async function fetchBlogsMine(token: string): Promise<BlogPost[]> {
  try {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") || "http";
    if (!host) return [];
    const r = await fetch(`${proto}://${host}/api/blog?mine=1`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const text = await r.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      console.error("Blog page mine fetch parse error:", r.status, text.slice(0, 200));
      return [];
    }
    const rows = (j.blogs || []) as BlogPost[];
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error("Blog page mine fetch error:", e);
    return [];
  }
}

function stripHeadingMarkers(text: string) {
  return (text || "")
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      if (trimmed === "---") return "";
      // Strip headings (#, ##, ###) and media placeholders ([image:X], [video:X])
      return line
        .replace(/^#+\s+/, "")
        .replace(/\[(image|video):\d+\]/g, "");
    })
    .join(" ");
}

function excerpt(text: string, len = 160) {
  const s = stripHeadingMarkers(text || "").trim();
  return s.length > len ? s.slice(0, len).trimEnd() + "…" : s;
}

function toSlug(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toSrc(b: BlogPost) {
  const coverSrc = b.coverPath ? `/api/image/proxy?path=${encodeURIComponent(String(b.coverPath))}` : null;
  const mediaSrc = !coverSrc && b.media && b.media.length && b.media[0]?.path ? `/api/image/proxy?path=${encodeURIComponent(String(b.media[0].path))}` : null;
  return coverSrc || mediaSrc;
}

function monthName(m: number) {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m] || "";
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  const publicBlogs = await fetchBlogsPublic();
  const mineBlogs = publicBlogs.length ? [] : (token ? await fetchBlogsMine(token) : []);
  const allBlogs = (publicBlogs.length ? publicBlogs : mineBlogs).slice().sort((a, b) => {
    const ta = Number(new Date(a.createdAt));
    const tb = Number(new Date(b.createdAt));
    return tb - ta;
  });

  let blogs = [...allBlogs];

  if (category) {
    blogs = blogs.filter(b => b.category === category);
  }

  if (q) {
    const lowerQ = q.toLowerCase();
    // Check if q is "Month Year"
    const monthYearMatch = q.match(/^([a-zA-Z]+)\s+(\d{4})$/);
    if (monthYearMatch) {
      const mName = monthYearMatch[1].toLowerCase();
      const year = parseInt(monthYearMatch[2], 10);
      const mIndex = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(mName);
      if (mIndex !== -1) {
        blogs = blogs.filter(b => {
          const d = new Date(b.createdAt);
          return d.getUTCFullYear() === year && d.getUTCMonth() === mIndex;
        });
      } else {
        blogs = blogs.filter(b => b.title.toLowerCase().includes(lowerQ) || b.description.toLowerCase().includes(lowerQ));
      }
    } else {
      blogs = blogs.filter(b => b.title.toLowerCase().includes(lowerQ) || b.description.toLowerCase().includes(lowerQ));
    }
  }

  const featured = blogs.find(b => !!b.featured) || blogs[0] || null;
  const rest = blogs.filter(b => b.id !== featured?.id);

  const archiveEntries: { year: number; month: number }[] = [];
  for (const b of allBlogs) {
    const d = new Date(b.createdAt);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    if (!archiveEntries.some(e => e.year === y && e.month === m)) {
      archiveEntries.push({ year: y, month: m });
    }
  }
  archiveEntries.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  const topArchive = archiveEntries.slice(0, 6);

  return (
    <div className="container pt-6">
      {(q || category) && (
        <div className="mb-6 flex items-center justify-between bg-slate-100 p-3 rounded-md">
          <div className="text-sm font-medium">
            Showing results for: <span className="text-blue-600 font-bold">{q || category}</span>
          </div>
          <Link prefetch={false} href="/blog" className="text-xs text-red-600 hover:underline">Clear filter</Link>
        </div>
      )}
      {!blogs.length && (
        <div className="card text-center text-sm text-black py-6">No blog posts found for &quot;{q || category}&quot;</div>
      )}
      {!!blogs.length && (
        <>
          {featured && (
            <section className="space-y-3">
              <div className="relative w-full h-72 sm:h-96 rounded-md overflow-hidden bg-slate-200 shadow-md">
                {(() => {
                  const src = toSrc(featured);
                  if (src) {
                    return featured.media && featured.media[0]?.type === "video" && !featured.coverPath
                      ? <video src={src} className="absolute inset-0 w-full h-full object-cover" controls controlsList="nodownload" />
                      : <Image src={src} alt={featured.title} fill sizes="(max-width: 640px) 100vw, 100vw" className="object-cover" unoptimized />;
                  }
                  return <div className="absolute inset-0 bg-slate-200" />;
                })()}
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-semibold">{featured.title}</div>
                <div className="text-sm text-slate-700">{excerpt(featured.description, 120)}</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[11px] text-slate-600 uppercase tracking-wide">
                    Posted by {featured.author || "Properties Cebu"}
                    {featured.displayDate ? ` on ${featured.displayDate}` : ""}
                  </span>
                  <Link href={`/blog/${encodeURIComponent(toSlug(featured.title))}`} className="inline-block rounded-full bg-orange-600 text-white px-3 py-1 text-xs" prefetch={false}>Read Full Post</Link>
                </div>
              </div>
            </section>
          )}

          <div className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-700">
            {category === "Tips and Guides"
              ? "Real estate | Tips and Guide"
              : category === "Featured Projects"
              ? "Latest Featured Projects | Philippine Real Estate"
              : category === "Real Estate Insights"
              ? "Insights and Blogs | Real Estate in Philippines"
              : "Wander Philippines | Tours"}
          </div>
          <div className="mt-1 border-t border-slate-300" />

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 items-start">
            <div className="space-y-3">
              <div className="text-sm font-semibold">{q ? `Results for ${q}` : "Latest Blogs"}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {rest.map(b => (
                  <div key={b.id} className="card p-0 overflow-hidden group transition-all duration-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:scale-[0.98] hover:ring-1 hover:ring-black/10">
                    <div className="relative w-full h-44 bg-slate-200 shadow-md">
                      {(() => {
                        const src = toSrc(b);
                        if (src) {
                          return b.media && b.media[0]?.type === "video" && !b.coverPath
                            ? <video src={src} className="absolute inset-0 w-full h-full object-cover" controls controlsList="nodownload" />
                            : <Image src={src} alt={b.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" unoptimized />;
                        }
                        return <div className="absolute inset-0 bg-slate-200" />;
                      })()}
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="text-base font-semibold">{b.title}</div>
                      <div className="text-[12px] text-slate-600">
                        Posted by {b.author || "Properties Cebu"}
                        {b.displayDate ? ` on ${b.displayDate}` : ""}
                      </div>
                      <div className="text-sm text-black">{excerpt(b.description)}</div>
                      <Link href={`/blog/${encodeURIComponent(toSlug(b.title))}`} className="inline-block rounded bg-orange-600 text-white px-3 py-1 text-xs" prefetch={false}>Read Full Post</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="space-y-4">
              <div className="card p-4 space-y-2">
                <div className="text-sm font-semibold">Read More Blogs</div>
                {topArchive.length === 0 ? (
                  <div className="text-xs text-slate-500">No archive yet</div>
                ) : (
                  <div className="text-xs space-y-1">
                    {(() => {
                      const grouped: Record<string, { month: string; index: number }[]> = {};
                      for (const a of topArchive) {
                        const key = String(a.year);
                        grouped[key] = grouped[key] || [];
                        grouped[key].push({ month: monthName(a.month), index: a.month });
                      }
                      const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));
                      return (
                        <>
                          {years.map(y => (
                            <div key={y} className="space-y-1">
                              <div className="font-semibold">{y}</div>
                              <div className="flex flex-wrap gap-1">
                                {grouped[y].map(({ month }, midx) => (
                                  <Link
                                    key={midx}
                                    href={`/blog?q=${encodeURIComponent(month)} ${y}`}
                                    className="px-2 py-0.5 rounded border bg-white text-slate-800 hover:bg-slate-50 transition-colors"
                                    prefetch={false}
                                  >
                                    {month}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
      <MainFooterCards />
    </div>
  );
}
