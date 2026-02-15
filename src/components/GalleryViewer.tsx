"use client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import ShareButtons from "./ShareButtons";
import { getProxyImageUrl } from "@/lib/supabase";

  function isVideo(url: string) {
    if (!url) return false;
    try { 
      const u = new URL(url); 
      return /\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname) || u.pathname.includes('/videos/');
    } catch { 
      return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url) || url.includes('/videos/');
    }
  }

export default function GalleryViewer({ items, title, address, price }: { items: { url: string }[]; title?: string; address?: string; price?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const mainVideoEl = useRef<HTMLVideoElement | null>(null);
  const [unmuteOnLoad, setUnmuteOnLoad] = useState(false);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  function next() { if (items.length) setIndex(i => (i + 1) % items.length); }
  function prev() { if (items.length) setIndex(i => (i - 1 + items.length) % items.length); }
  function onTouchStart(e: React.TouchEvent) { 
    touchX.current = e.touches[0].clientX; 
    touchY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) { 
    if (touchX.current !== null && touchY.current !== null) { 
      const dx = e.changedTouches[0].clientX - touchX.current; 
      const dy = e.changedTouches[0].clientY - touchY.current;
      
      // Ensure it's mostly a horizontal swipe
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx > 40) prev(); 
        if (dx < -40) next(); 
      }
      touchX.current = null; 
      touchY.current = null;
    } 
  }

  const current = items[index];
  const hasSrc = !!(current && current.url);
  return (
    <div>
      <div className="relative w-full h-72 sm:h-96 rounded-md overflow-hidden shadow-md" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {hasSrc && (isVideo(current.url) ? (
          <video
              key={current.url}
              ref={mainVideoEl}
              src={current.url}
              controls
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
              controlsList="nodownload"
              className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
            onLoadedData={() => {
              if (unmuteOnLoad) {
                const v = mainVideoEl.current;
                if (v) { v.muted = false; v.volume = 1; v.play().catch(()=>{}); }
                setUnmuteOnLoad(false);
              }
            }}
            onClick={() => { setScale(1); setOpen(true); }}
            onError={(e) => { 
              const v = mainVideoEl.current;
              if (v && v.error) {
                // Ignore code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) if it's just an abort
                if (v.error.code !== 4) {
                  console.error("GalleryViewer: Main video error:", v.error.code, v.error.message);
                }
              }
            }}
          />
        ) : (
          <Image 
            src={getProxyImageUrl(current.url)} 
            alt="media" 
            fill 
            className="object-cover cursor-zoom-in" 
            onClick={() => { setScale(1); setOpen(true); }} 
            onError={() => {
              console.error("GalleryViewer: Main image failed to load:", current.url);
            }}
          />
        ))}
        {!hasSrc && (
          <div className="absolute inset-0 bg-slate-200 rounded flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-gray-500"><path d="M3 9.5l9-7 9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z"/><path d="M9 22V12h6v10"/></svg>
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 px-2 sm:px-3 pt-2 flex justify-end pointer-events-none">
          <ShareButtons title={title} address={address} />
        </div>
        {items.length > 1 && (
          <>
            <button aria-label="Prev" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 text-black grid place-items-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button aria-label="Next" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 text-black grid place-items-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </>
        )}
        {!hasSrc || isVideo(current.url) ? null : (
          <div className="absolute top-2 left-2 sm:left-3 text-xs bg-black/40 text-white rounded px-2 py-1">Click photo to view fullscreen</div>
        )}
        {hasSrc && isVideo(current.url) ? (
          <div className="absolute top-2 left-2 sm:left-3 text-xs bg-black/40 text-white rounded px-2 py-1">Click video to view fullscreen</div>
        ) : null}
        {title || address || typeof price === "number" ? (
          <div className="absolute left-0 right-0 bottom-0 bg-[#260038] text-white px-3 py-2 sm:px-4 sm:py-3 pointer-events-none">
            <div className="flex items-end justify-between gap-3">
              <div className="flex-1">
                {title ? <div className="text-sm sm:text-base font-semibold leading-tight">{title}</div> : null}
                {address ? <div className="text-xs sm:text-sm opacity-90 leading-tight">{address}</div> : null}
              </div>
              {typeof price === "number" ? (
                <div className="text-right shrink-0">
                  <div className="flex justify-end mb-0.5 opacity-90">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 6h8a3 3 0 0 1 0 6H7" />
                      <path d="M7 12h8a3 3 0 0 1 0 6H7" />
                      <path d="M5 9h10" />
                      <path d="M5 15h10" />
                      <path d="M7 6v12" />
                    </svg>
                  </div>
                  <div className="text-base sm:text-xl font-bold">{mounted ? Number(price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : ""}</div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {items.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <div className="flex gap-2">
              {items.map((it, i) => (
                <button key={i} onClick={() => { setIndex(i); if (isVideo(it.url)) setUnmuteOnLoad(true); }} className={`relative w-24 h-16 rounded overflow-hidden border shadow-sm ${i === index ? "border-blue-500" : "border-gray-200"}`}>
                {isVideo(it.url) ? (
                  <video 
                    src={it.url} 
                    className="absolute inset-0 w-full h-full object-cover" 
                    muted 
                    autoPlay={i === index} 
                    loop 
                    playsInline 
                    preload={i === index ? "metadata" : "none"} 
                    controlsList="nodownload" 
                  />
                ) : (
                  <Image 
                    src={getProxyImageUrl(it.url)} 
                    alt="thumb" 
                    fill 
                    sizes="96px" 
                    className="object-cover" 
                    onError={() => {
                      console.error(`GalleryViewer: Thumbnail ${i} failed to load:`, it.url);
                    }}
                  />
                )}
                </button>
              ))}
          </div>
        </div>
      )}
      {open && hasSrc && !isVideo(current.url) && (
        <div className="fixed inset-0 bg-black/80 z-50" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="absolute inset-0 flex items-center justify-center" onWheel={(e)=>{ const d = e.deltaY < 0 ? 0.1 : -0.1; const ns = Math.min(3, Math.max(0.5, scale + d)); setScale(ns); }}>
            <div className="relative w-[90vw] h-[90vh]" style={{ transform: `scale(${scale})` }}>
              <Image 
                src={getProxyImageUrl(current.url)} 
                alt="view" 
                fill 
                sizes="90vw" 
                className="object-contain" 
                onError={() => {
                  console.error("GalleryViewer: Fullscreen image failed to load:", current.url);
                }}
              />
            </div>
          </div>
          <div className="absolute top-3 right-3 flex gap-2">
            <button onClick={() => setOpen(false)} className="rounded-md bg-white/80 px-3 py-1 text-sm">Close</button>
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="rounded-md bg-white/80 px-3 py-1 text-sm">Zoom Out</button>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="rounded-md bg-white/80 px-3 py-1 text-sm">Zoom In</button>
          </div>
          {items.length > 1 && (
            <>
              <button aria-label="Prev" onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white grid place-items-center transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button aria-label="Next" onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white grid place-items-center transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M9 6l6 6-6 6"/></svg>
              </button>
            </>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button onClick={prev} className="rounded-md bg-white/80 px-3 py-1 text-sm">Prev</button>
            <button onClick={next} className="rounded-md bg-white/80 px-3 py-1 text-sm">Next</button>
          </div>
        </div>
      )}
      {open && hasSrc && isVideo(current.url) && (
        <div className="fixed inset-0 bg-black/80 z-50" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="absolute inset-0 flex items-center justify-center" onWheel={(e)=>{ const d = e.deltaY < 0 ? 0.1 : -0.1; const ns = Math.min(3, Math.max(0.5, scale + d)); setScale(ns); }}>
            <video
              ref={videoEl}
              src={current.url}
              controls
              autoPlay
              controlsList="nodownload"
              preload="auto"
              className="max-w-[90vw] max-h-[90vh] object-contain"
              style={{ transform: `scale(${scale})` }}
              onLoadedData={() => { const el = videoEl.current; if (el) { el.muted = false; el.volume = 1; } }}
            />
          </div>
          <div className="absolute top-3 right-3 flex gap-2">
            <button onClick={() => setOpen(false)} className="rounded-md bg-white/80 px-3 py-1 text-sm">Close</button>
            <button onClick={() => { const el = videoEl.current; if (el && el.requestFullscreen) el.requestFullscreen(); }} className="rounded-md bg-white/80 px-3 py-1 text-sm">Fullscreen</button>
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="rounded-md bg-white/80 px-3 py-1 text-sm">Zoom Out</button>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="rounded-md bg-white/80 px-3 py-1 text-sm">Zoom In</button>
          </div>
          {items.length > 1 && (
            <>
              <button aria-label="Prev" onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white grid place-items-center transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button aria-label="Next" onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white grid place-items-center transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><path d="M9 6l6 6-6 6"/></svg>
              </button>
            </>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button onClick={prev} className="rounded-md bg-white/80 px-3 py-1 text-sm">Prev</button>
            <button onClick={next} className="rounded-md bg-white/80 px-3 py-1 text-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
