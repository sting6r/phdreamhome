"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getProxyImageUrl } from "@/lib/supabase";

export default function SimilarCarousel({ items }: { items: any[] }) {
  const safeItems = Array.isArray(items) ? items : [];
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const perPage = 3;
  const pages = Array.from({ length: Math.max(1, Math.ceil((safeItems.length || 0) / perPage)) }, (_, i) => safeItems.slice(i * perPage, i * perPage + perPage));
  const [index, setIndex] = React.useState(0);
  const total = pages.length;
  React.useEffect(() => {
    if (!total) return;
    const id = setInterval(() => { setIndex(i => (i + 1) % total); }, 5000);
    return () => clearInterval(id);
  }, [total]);
  function prev() { setIndex(i => (i - 1 + total) % total); }
  function next() { setIndex(i => (i + 1) % total); }
  function typeText(l: any) { const sub = l.type === "Industrial Properties" ? (l.industrySubtype || "") : l.type === "Commercial Space" ? (l.commercialSubtype || "") : ""; return sub ? `${l.type} — ${sub}` : l.type; }
  if (!safeItems || safeItems.length === 0) return <div className="text-sm text-slate-700">No similar properties found.</div>;
  return (
    <div className="relative">
      <div className="overflow-hidden">
        <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${index * 100}%)` }}>
          {pages.map((group, gi) => (
            <div key={gi} className="w-full shrink-0 px-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.map((l: any) => {
                  const isRent = String(l.status || "").toLowerCase() === "for rent";
                  const priceTxt = mounted ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(l.price || 0)) : "";
                  const beds = Number(l.bedrooms || 0);
                  const baths = Number(l.bathrooms || 0);
                  const parking = Number(l.parking || 0);
                  const imgUrl = l.imageUrl || "";
                  const loc = [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
                  const landmarks = Array.isArray(l.landmarks) ? l.landmarks.filter(Boolean) : [];
                  const shown = landmarks.slice(0, 3);
                  const more = Math.max(0, landmarks.length - shown.length);
                  const dev = l.developer || "n/a";
                  const pt = typeText(l);
                  return (
                    <div key={l.id} className="card space-y-3 group transition-all duration-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:scale-[0.98] hover:ring-1 hover:ring-black/10">
                      <div className="relative w-full h-44 rounded overflow-hidden bg-slate-200">
                        {imgUrl ? (
                          <Image 
                            src={getProxyImageUrl(imgUrl)} 
                            alt={l.title} 
                            fill 
                            className="object-cover" 
                            onError={() => {
                              console.error("SimilarCarousel: Image failed to load:", imgUrl);
                            }}
                          />
                        ) : null}
                        {l.status ? <div className="absolute top-2 left-2 text-xs px-3 py-1 rounded-full bg-[#DE6A4A] text-white border border-white shadow-sm">{l.status}</div> : null}
                        <div className="absolute bottom-2 right-2 text-sm font-bold bg-black/60 text-white px-2 py-1 rounded">{priceTxt}{isRent ? <span className="text-xs font-normal">/month</span> : null}</div>
                      </div>
                      <div className="text-lg font-semibold">{l.title}</div>
                      <div className="text-xs text-slate-700 inline-flex items-center gap-1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-orange-500"><path d="M12 21s-8-4.5-8-11a8 8 0 1 1 16 0c0 6.5-8 11-8 11Z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>{loc}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {baths > 0 ? <div className="rounded border px-2 py-1 text-xs inline-flex items-center gap-1"><span>Bathroom</span><span className="font-bold">{baths}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-700"><path d="M4 11h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"/><path d="M8 11V8a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v3"/></svg></div> : null}
                        {beds > 0 ? <div className="rounded border px-2 py-1 text-xs inline-flex items-center gap-1"><span>Bedroom</span><span className="font-bold">{beds}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-700"><path d="M3 7v11"/><rect x="7" y="11" width="14" height="7" rx="2"/><path d="M7 11V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2"/></svg></div> : null}
                        {parking > 0 ? <div className="rounded border px-2 py-1 text-xs inline-flex items-center gap-1"><span>Parking</span><span className="font-bold">{parking}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-700"><path d="M6 19V5h8a4 4 0 0 1 0 8H6"/><path d="M6 15h8"/></svg></div> : null}
                      </div>
                      <div>
                        <div className="text-xs text-slate-700">Nearby Landmarks</div>
                        <div className="mt-1 space-y-0.5 text-xs text-blue-600">
                          {shown.map((lm: string, i: number) => (
                            <div key={i} className="inline-flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-orange-500"><path d="M12 21s-8-4.5-8-11a8 8 0 1 1 16 0c0 6.5-8 11-8 11Z"/><circle cx="12" cy="10" r="3"/></svg><span>{lm}</span></div>
                          ))}
                          {more > 0 ? <div className="text-orange-600">+{more} more</div> : null}
                        </div>
                      </div>
                      <div className="text-xs text-slate-700">
                        <div><span className="text-slate-700">Developer:</span> <span className="text-black">{dev}</span></div>
                        <div><span className="text-slate-700">Property Type:</span> <span className="text-black">{pt}</span></div>
                      </div>
                      <div className="pt-1">
                        <Link prefetch={false} href={`/listing/${l.slug || l.id}`} className="btn-blue px-4 py-2">View Details</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {safeItems.length > 0 ? (
        <>
          <button aria-label="Previous" onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 bg-white border rounded-full shadow px-3 py-2 text-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button aria-label="Next" onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border rounded-full shadow px-3 py-2 text-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </>
      ) : null}
    </div>
  );
}
