"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Item = { path: string; type: "image" | "video"; url: string | null };

export default function BlogMediaViewer({ media, title }: { media: Item[]; title: string }) {
  const items = useMemo(() => media.filter(m => !!m.url), [media]);
  const [index, setIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (index < 0) setIndex(0); if (index >= items.length) setIndex(items.length - 1); }, [index, items.length]);
  function prev() { setIndex(i => Math.max(0, i - 1)); }
  function next() { setIndex(i => Math.min(items.length - 1, i + 1)); }
  async function toggleFull() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    } else {
      await el.requestFullscreen().catch(() => {});
    }
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4 items-start">
      <div ref={wrapRef} className="relative w-full h-[360px] sm:h-[420px] rounded overflow-hidden bg-slate-200">
        {items[index]?.type === "image" && items[index]?.url ? (
          <Image src={items[index]!.url as string} alt={title} fill sizes="(max-width: 640px) 100vw, 60vw" className="object-cover" />
        ) : items[index]?.type === "video" && items[index]?.url ? (
          <video
            src={items[index]!.url as string}
            className="absolute inset-0 w-full h-full object-cover"
            controls
            controlsList="nodownload"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-200" />
        )}
        <div className="absolute left-2 bottom-2 flex items-center gap-2">
          <button type="button" className="px-2 py-1 rounded bg-white/90 text-black text-xs" onClick={prev} disabled={index===0}>Prev</button>
          <button type="button" className="px-2 py-1 rounded bg-white/90 text-black text-xs" onClick={next} disabled={index===items.length-1}>Next</button>
          <button type="button" className="px-2 py-1 rounded bg-white/90 text-black text-xs" onClick={toggleFull}>Full Screen</button>
        </div>
      </div>
      <div className="h-[420px] overflow-y-auto">
        <div className="grid grid-cols-1 gap-2">
          {items.map((m, i) => (
            <button key={i} type="button" className={`relative w-full h-20 rounded overflow-hidden border ${index===i?"border-blue-500":"border-gray-200"}`} onClick={() => setIndex(i)}>
              {m.type === "image" && m.url ? (
                <Image src={m.url} alt={title} fill sizes="200px" className="object-cover" />
              ) : m.type === "video" && m.url ? (
                <video
                  src={m.url}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                  controlsList="nodownload"
                />
              ) : (
                <div className="absolute inset-0 bg-slate-200" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
