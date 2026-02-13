import { headers } from "next/headers";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import MainFooterCards from "@components/MainFooterCards";
import BlogMediaViewer from "@components/BlogMediaViewer";
import ShareButtons from "@components/ShareButtons";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) return { title: "Blog Post Not Found" };

  const title = `${post.title} | PhDreamHome Blog`;
  const description = post.description?.slice(0, 160) || `Read more about ${post.title} on PhDreamHome.`;
  const ogImage = post.coverUrl || "https://www.phdreamhome.com/logo.svg";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://www.phdreamhome.com/blog/${id}`,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `https://www.phdreamhome.com/blog/${id}`,
    }
  };
}

type BlogMedia = { path: string; type: "image" | "video"; url: string | null; title?: string | null; subtitle?: string | null; description?: string | null; published?: boolean };
type BlogPost = { id: string; userId: string; title: string; description: string; author?: string | null; displayDate?: string | null; coverPath: string | null; coverUrl: string | null; media: BlogMedia[]; published: boolean; createdAt: string | number | Date };

async function fetchPost(id: string): Promise<BlogPost | null> {
  try {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") || "http";
    if (!host) return null;
    const r = await fetch(`${proto}://${host}/api/blog/${id}`, { cache: "no-store" });
    const j = await r.json();
    const p = j.post;
    if (!p) return null;
    return p as BlogPost;
  } catch {
    return null;
  }
}

async function fetchBlogs(): Promise<{ createdAt: number }[]> {
  try {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") || "http";
    if (!host) return [];
    const r = await fetch(`${proto}://${host}/api/blog`, { cache: "no-store" });
    const j = await r.json();
    const pubs = (j.blogs || []) as Array<{ createdAt: number }>;
    return Array.isArray(pubs) ? pubs : [];
  } catch {
    return [];
  }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) {
    return (
      <div className="container pt-6">
        <div className="card text-center text-sm text-black py-6">Post not found</div>
      </div>
    );
  }
  const months = Array.from(new Set((await fetchBlogs()).map(b => {
    const d = new Date(b.createdAt);
    const y = d.getFullYear();
    const m = d.toLocaleString("en-PH", { month: "long" });
    return `${y}|${m}`;
  })));
  function formatDateUTC(d: Date) {
    try {
      return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }
  function renderInlineFormatting(text: string) {
    if (typeof text !== "string") return text;
    const nodes: (string | ReactNode)[] = [];
    let key = 0;

    function pushFormattedSegment(segment: string) {
      const pattern = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(segment)) !== null) {
        if (match.index > lastIndex) {
          nodes.push(segment.slice(lastIndex, match.index));
        }
        if (match[1]) {
          nodes.push(
            <strong key={key++}>
              <em>{match[1]}</em>
            </strong>
          );
        } else if (match[2]) {
          nodes.push(<strong key={key++}>{match[2]}</strong>);
        } else if (match[3] || match[4]) {
          nodes.push(<em key={key++}>{match[3] || match[4]}</em>);
        }
        lastIndex = pattern.lastIndex;
      }
      if (lastIndex < segment.length) {
        nodes.push(segment.slice(lastIndex));
      }
    }

    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        pushFormattedSegment(text.slice(lastIndex, match.index));
      }
      const linkText = match[1];
      const href = match[2];
      nodes.push(
        <a
          key={key++}
          href={href}
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkText}
        </a>
      );
      lastIndex = linkPattern.lastIndex;
    }
    if (lastIndex < text.length) {
      pushFormattedSegment(text.slice(lastIndex));
    }

    return nodes;
  }

  function renderDescription(desc: string, media: BlogMedia[]) {
    const blocks = String(desc || "")
      .split("\n\n")
      .map(p => p.trim())
      .filter(Boolean);
    const nodes: ReactNode[] = [];
    let key = 0;

    const mediaPlaceholderPattern = /\[(image|video):(\d+)\]/g;

    for (const block of blocks) {
      const lines = block.split("\n");
      for (const line of lines) {
        let displayLine = line;
        const isH3 = /^###\s+/.test(line);
        const isH2 = /^##\s+/.test(line);
        const isH1 = /^#\s+/.test(line);
        const isList = /^[-•]\s+/.test(line);

        if (isH3) displayLine = line.replace(/^###\s+/, "");
        else if (isH2) displayLine = line.replace(/^##\s+/, "");
        else if (isH1) displayLine = line.replace(/^#\s+/, "");
        else if (isList) displayLine = line.replace(/^[-•]\s+/, "");

        const lineNodes: ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = mediaPlaceholderPattern.exec(displayLine)) !== null) {
          if (match.index > lastIndex) {
            lineNodes.push(renderInlineFormatting(displayLine.slice(lastIndex, match.index)));
          }
          const mediaType = match[1];
          const mediaIndex = parseInt(match[2], 10);
          const mediaItem = media[mediaIndex];

          if (mediaItem && mediaItem.url) {
            if (mediaType === "image") {
              lineNodes.push(
                <div key={key++} className="relative w-full h-72 sm:h-96 rounded overflow-hidden bg-slate-200 my-4">
                  <Image src={`/api/image/proxy?path=${encodeURIComponent(mediaItem.path)}`} alt={mediaItem.title || "Blog image"} fill sizes="(max-width: 640px) 100vw, 60vw" className="object-cover" unoptimized />
                </div>
              );
            } else if (mediaType === "video") {
              lineNodes.push(
                <div key={key++} className="relative w-full h-72 sm:h-96 rounded overflow-hidden bg-slate-200 my-4">
                  <video
                    src={`/api/image/proxy?path=${encodeURIComponent(mediaItem.path)}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    controls
                    preload="auto"
                    controlsList="nodownload"
                  />
                </div>
              );
            }
          }
          lastIndex = mediaPlaceholderPattern.lastIndex;
        }

        if (lastIndex < displayLine.length) {
          lineNodes.push(renderInlineFormatting(displayLine.slice(lastIndex)));
        }

        if (isH3) {
          nodes.push(
            <h3 key={key++} className="mt-6 text-lg font-semibold">
              {lineNodes}
            </h3>
          );
        } else if (isH2) {
          nodes.push(
            <h2 key={key++} className="mt-8 text-xl font-semibold">
              {lineNodes}
            </h2>
          );
        } else if (isH1) {
          nodes.push(
            <h1 key={key++} className="mt-10 text-2xl font-semibold">
              {lineNodes}
            </h1>
          );
        } else if (isList) {
          nodes.push(
            <div key={key++} className="mt-2 ml-4 flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
              <div className="text-base text-black">
                {lineNodes}
              </div>
            </div>
          );
        } else if (line.trim() === "---") {
          nodes.push(<hr key={key++} className="my-10 border-t-2 border-slate-300" />);
        } else if (line.trim()) {
          nodes.push(
            <div key={key++} className="mt-4 text-base text-black">
              {lineNodes}
            </div>
          );
        }
      }
    }
    if (!nodes.length && desc) {
      nodes.push(
        <div key="plain" className="mt-4 text-base text-black whitespace-pre-wrap">
          {renderInlineFormatting(desc)}
        </div>
      );
    }
    return nodes;
  }

  return (
    <div className="container pt-6">
      <article className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6 items-start">
          <div className="space-y-3">
            <div className="flex justify-end">
              <ShareButtons title={post.title} />
            </div>
            <div className="relative w-full h-80 sm:h-[450px] rounded overflow-hidden bg-slate-200 shadow-md">
              {post.coverPath ? (
                <Image src={`/api/image/proxy?path=${encodeURIComponent(post.coverPath)}`} alt={post.title} fill sizes="(max-width: 640px) 100vw, 60vw" className="object-cover" unoptimized />
              ) : (
                <div className="absolute inset-0 bg-slate-200" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{post.title}</h1>
              <div className="text-sm text-slate-700 mt-2">
                Posted by {post.author || "Properties Cebu"} on {post.displayDate || formatDateUTC(new Date(post.createdAt))}
              </div>
              <div className="mt-6">
                {renderDescription(post.description || "", post.media)}
              </div>
              <div className="mt-3">
                <Link href="/blog" className="px-4 py-2 rounded-md border text-sm hover:bg-slate-50 transition-colors" prefetch={false}>Back to Blog</Link>
              </div>
            </div>
          </div>
          <div>
            <div className="card p-4">
              <div className="text-sm font-semibold">Read More Blogs</div>
              <div className="mt-2 space-y-1 text-sm">
                {months.slice(0, 6).map((key) => {
                  const [y, m] = key.split("|");
                  return (
                    <Link key={key} href={`/blog?q=${encodeURIComponent(m)} ${y}`} className="block" prefetch={false}>{m}</Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </article>
      <MainFooterCards />
    </div>
  );
}
