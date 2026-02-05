"use client";
import React, { Suspense, use } from "react";
import MainFooterCards from "../../../components/MainFooterCards";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";

const fetcher = async (u: string, signal?: AbortSignal) => {
  try {
    const r = await fetch(u, { 
      signal, 
      cache: "no-store",
      headers: {
        'Accept': 'application/json',
      }
    });
    if (!r.ok) {
      if (r.status === 404) return null;
      const text = await r.text();
      console.error(`Properties fetcher error [${r.status}]:`, u, text.slice(0, 100));
      return null;
    }
    return await r.json();
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    if (e instanceof TypeError && e.message === "Failed to fetch") return null;
    console.error("Properties fetcher error:", u, e);
    return null;
  }
};

function toTitle(slug: string) {
  const s = (slug || "").trim().toLowerCase();
  if (!s) return "Properties";
  if (s === "rfo") return "RFO";
  return s.split("-").map(w => w.slice(0,1).toUpperCase() + w.slice(1)).join(" ");
}

function PropertiesByStatusPageContent({ params }: { params: Promise<{ status: string }> }) {
  const { status: statusSlug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeParam = (searchParams.get("type") || "").trim();
  const commercialSubtypeParam = (searchParams.get("commercialSubtype") || "").trim();
  const industrySubtypeParam = (searchParams.get("industrySubtype") || "").trim();
  const statusTitle = toTitle(statusSlug);
  const [listings, setListings] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    fetcher("/api/public-listings", controller.signal).then((d) => {
      if (!alive) return;
      setListings(d?.listings ?? []);
      setIsLoading(false);
    }).catch(() => { if (alive) setIsLoading(false); });
    return () => { 
      alive = false; 
      controller.abort();
    };
  }, []);

  const [q, setQ] = React.useState("");
  const [priceSel, setPriceSel] = React.useState<string>("Price Range");
  const [typeSel, setTypeSel] = React.useState<string>(typeParam || "All Types");
  const [expandedListings, setExpandedListings] = React.useState<string[]>([]);
  const [inqName, setInqName] = React.useState("");
  const [inqEmail, setInqEmail] = React.useState("");
  const [inqPhone, setInqPhone] = React.useState("");
  const [inqSubject, setInqSubject] = React.useState("");
  const [inqMessage, setInqMessage] = React.useState("");
  const [inqSent, setInqSent] = React.useState<string | null>(null);
  const [inqError, setInqError] = React.useState<string | null>(null);
  const [inqLoading, setInqLoading] = React.useState(false);
  const [inqEmailSuggestion, setInqEmailSuggestion] = React.useState<string | null>(null);

  const clearInqMessages = () => {
    setInqSent(null);
    setInqError(null);
  };

  const getEmailSuggestion = (email: string) => {
    const commonDomains: Record<string, string> = {
      "gmial.com": "gmail.com",
      "gamil.com": "gmail.com",
      "gmal.com": "gmail.com",
      "gnail.com": "gmail.com",
      "gmai.com": "gmail.com",
      "gmaill.com": "gmail.com",
      "yaho.com": "yahoo.com",
      "yahuo.com": "yahoo.com",
      "hotmal.com": "hotmail.com",
      "hotmial.com": "hotmail.com",
      "outlok.com": "outlook.com",
      "outluk.com": "outlook.com",
      "iclud.com": "icloud.com",
      "icloud.co": "icloud.com",
    };
    const [local, domain] = email.split("@");
    if (!domain) return null;
    const suggestion = commonDomains[domain.toLowerCase()];
    return suggestion ? `${local}@${suggestion}` : null;
  };

  const handleInqEmailChange = (val: string) => {
    setInqEmail(val);
    clearInqMessages();
    setInqEmailSuggestion(getEmailSuggestion(val));
  };

  const autoCorrectPhone = (val: string) => {
    let clean = val.replace(/\D/g, "");
    if (clean.startsWith("63") && clean.length > 10) {
      clean = "0" + clean.slice(2);
    }
    return clean.slice(0, 11);
  };
  const [inqDev, setInqDev] = React.useState(false);
  const [showTypeMenu2, setShowTypeMenu2] = React.useState(true);
  const [showCommercialMenu2, setShowCommercialMenu2] = React.useState(false);
  const [showIndustrialMenu2, setShowIndustrialMenu2] = React.useState(false);
  const allowedTypes = React.useMemo(() => (["All Types","Condominium","Town House","House and Lot","Lot Only","Beach Property","Commercial Space","Industrial Properties"] as const), []);
  React.useEffect(() => {
    const t = typeParam;
    if (!t) { setTypeSel("All Types"); return; }
    setTypeSel(allowedTypes.includes(t as any) ? t : "All Types");
  }, [typeParam, allowedTypes]);
  const [selectedStatus, setSelectedStatus] = React.useState<string>(statusSlug);
  const [commercialSubtypeSel, setCommercialSubtypeSel] = React.useState<string>("");
  const [industrySubtypeSel, setIndustrySubtypeSel] = React.useState<string>("");
  const selectedStatusTitle = toTitle(selectedStatus);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    setShowTypeMenu2(true);
    setShowCommercialMenu2(false);
    setShowIndustrialMenu2(false);
  }, [selectedStatus]);
  const [sortSel, setSortSel] = React.useState<string>("Sort by Recently Updated");
  const [viewMode, setViewMode] = React.useState<"list" | "map">("list");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const [geocodes, setGeocodes] = React.useState<Record<string, { lat: number; lon: number }>>({});
  const mapRootRef = React.useRef<HTMLDivElement | null>(null);
  const mapObjRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);
  const [leafletReady, setLeafletReady] = React.useState(false);
  const userHasInteractedRef = React.useRef(false);
  const isProgrammaticMoveRef = React.useRef(false);
  async function loadLeaflet() {
    if (typeof window === "undefined") return null;
    const w: any = window;
    if (w.L) return w.L;

    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const jsId = "leaflet-js";
    if (!document.getElementById(jsId)) {
      const s = document.createElement("script");
      s.id = jsId;
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      document.body.appendChild(s);
    }

    return new Promise((resolve) => {
      if (w.L) return resolve(w.L);
      const interval = setInterval(() => {
        if (w.L) {
          clearInterval(interval);
          resolve(w.L);
        }
      }, 100);
    });
  }
  async function geocodeOne(l: any, signal?: AbortSignal) {
    const q = [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q || l.city || l.state || l.country || "Philippines")}`;
    const fallback = { lat: 12.8797, lon: 121.774 };
    try {
      const r = await fetch(url, { 
        headers: { Accept: "application/json", "User-Agent": "phdreamhome/1.0" } as any,
        signal
      });
      const d = await r.json();
      const best = Array.isArray(d) ? d[0] : null;
      if (best && best.lat && best.lon) return { lat: Number(best.lat), lon: Number(best.lon) };
    } catch (e: any) {
      if (e.name === 'AbortError') return null;
    }
    return fallback;
  }
  

  const effectiveType = typeParam || typeSel;
  const normalizedType = effectiveType === "All Types" ? "" : effectiveType.toLowerCase();
  const normalizedStatus = statusTitle.toLowerCase();
  const effectiveIndustrySubtype = (industrySubtypeParam || industrySubtypeSel).toLowerCase();
  const effectiveCommercialSubtype = (commercialSubtypeParam || commercialSubtypeSel).toLowerCase();
  function parsePriceRange(s: string): [number|null, number|null] {
    const v = (s || "").trim();
    if (!v || v === "Price Range") return [null, null];
    if (/^₱0–₱1M$/.test(v)) return [0, 1_000_000];
    if (/^₱1M–₱5M$/.test(v)) return [1_000_000, 5_000_000];
    if (/^₱5M–₱10M$/.test(v)) return [5_000_000, 10_000_000];
    if (/^₱10M\+$/.test(v)) return [10_000_000, null];
    return [null, null];
  }
  const [minPrice, maxPrice] = parsePriceRange(priceSel);
  const filtered = listings.filter((l:any)=>{
    const byStatus = normalizedStatus ? String(l.status || "").toLowerCase() === normalizedStatus : true;
    const byType = normalizedType ? String(l.type || "").toLowerCase() === normalizedType : true;
    const price = Number(l.price || 0);
    const byMin = minPrice != null ? price >= Number(minPrice) : true;
    const byMax = maxPrice != null ? price <= Number(maxPrice) : true;
    const text = [l.title, l.address, l.city, l.developer].filter(Boolean).join(" ").toLowerCase();
    const byQ = q ? text.includes(q.toLowerCase()) : true;
    const bySubtype = normalizedType === "industrial properties"
      ? (effectiveIndustrySubtype ? String((l as any).industrySubtype || "").toLowerCase() === effectiveIndustrySubtype : true)
      : normalizedType === "commercial space"
        ? (effectiveCommercialSubtype ? String((l as any).commercialSubtype || "").toLowerCase() === effectiveCommercialSubtype : true)
        : true;
    return byStatus && byType && byMin && byMax && byQ && bySubtype;
  });
  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    if (sortSel === "Sort by Price High to Low") {
      arr.sort((a:any,b:any)=> Number(b.price || 0) - Number(a.price || 0));
    } else if (sortSel === "Sort by Price Low to High") {
      arr.sort((a:any,b:any)=> Number(a.price || 0) - Number(b.price || 0));
    } else if (sortSel === "Sort by Recently Updated") {
      arr.sort((a:any,b:any)=> new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    }
    return arr;
  }, [filtered, sortSel]);

  React.useEffect(() => {
    if (viewMode !== "map") return;
    let alive = true;
    const controller = new AbortController();
    (async () => {
      const L = await loadLeaflet();
      if (!alive) return;
      setLeafletReady(true);
      if (!mapObjRef.current && mapRootRef.current) {
        isProgrammaticMoveRef.current = true;
        mapObjRef.current = L.map(mapRootRef.current, { closePopupOnClick: false }).setView([12.8797, 121.774], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapObjRef.current);
        setTimeout(() => { isProgrammaticMoveRef.current = false; }, 0);
        mapObjRef.current.on("movestart", () => { if (!isProgrammaticMoveRef.current) userHasInteractedRef.current = true; });
        mapObjRef.current.on("zoomstart", () => { if (!isProgrammaticMoveRef.current) userHasInteractedRef.current = true; });
      }
      const missing = filtered.filter((l: any) => !geocodes[String(l.id || "")]);
      for (const l of missing) {
        if (!alive) break;
        const g = await geocodeOne(l, controller.signal);
        if (g && alive) setGeocodes((prev) => ({ ...prev, [String(l.id || "")]: g }));
        if (alive) await new Promise((res) => setTimeout(res, 300));
      }
    })();
    return () => { 
      alive = false; 
      controller.abort();
    };
  }, [viewMode, filtered, geocodes]);
  React.useEffect(() => {
    if (viewMode !== "list") return;
    try { markersRef.current.forEach((m) => { try { m.remove(); } catch {} }); } catch {}
    markersRef.current = [];
    try { if (mapObjRef.current) { mapObjRef.current.remove(); } } catch {}
    mapObjRef.current = null;
    userHasInteractedRef.current = false;
    setLeafletReady(false);
  }, [viewMode]);
  React.useEffect(() => {
    if (viewMode !== "map") return;
    const L: any = (window as any).L;
    if (!leafletReady || !mapObjRef.current || !L) return;
    try { mapObjRef.current.invalidateSize(true); } catch {}
    
    const pts = filtered.map((l: any) => ({ l, g: geocodes[String(l.id || "")] })).filter((x) => !!x.g);

    // Only clear and recreate if the set of listing IDs has actually changed
    // or if we have no markers yet. This prevents popups from closing
    // during the geocoding process or minor state updates.
    const currentListingIds = new Set(pts.map(x => String(x.l.id)));
    const existingMarkerIds = new Set(markersRef.current.map(m => m.options.listingId));
    
    const idsChanged = currentListingIds.size !== existingMarkerIds.size || 
                       [...currentListingIds].some(id => !existingMarkerIds.has(id));

    if (!idsChanged && markersRef.current.length > 0) return;

    markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
    markersRef.current = [];
    
    const customIcon = L.icon({
      iconUrl: "/pins/marker.svg",
      iconSize: [32, 32],
      iconAnchor: [16, 30],
      popupAnchor: [0, -28]
    });
    const bounds = L.latLngBounds([]);
    for (const x of pts) {
      const imgUrl = Array.isArray(x.l.images)
        ? (x.l.images.map((i: any) => i?.url).find((u: string) => u && !/\.(mp4|webm|ogg)$/i.test(((u.split("?" )[0]||u)))) || "")
        : "";
      const statusText = String(x.l.status || "");
      const emphasizeStatus = statusText === "Sold" || statusText === "Occupied";
      const isRent = statusText === "For Rent";
      const priceNum = mounted ? Number(x.l.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "";
      const monthly = isRent ? "/mo" : "";
      const titleText = String(x.l.title || "");
      const typeLabel = String(x.l.type || "").toUpperCase();
      const locText = (() => { const s = String(x.l.address || "").trim().toLowerCase(); return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : ""; })();
      const subLabel = x.l.type === "Industrial Properties"
        ? String((x.l as any).industrySubtype || "")
        : x.l.type === "Commercial Space"
          ? String((x.l as any).commercialSubtype || "")
          : "";
      const imageBlock = imgUrl
        ? `<img src="${imgUrl}" alt="${titleText}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
        : `<div style="position:absolute;inset:0;background:#e2e8f0"></div>`;
      const html = `
        <a href="/listing/${x.l.slug || x.l.id}" style="display:block;background:#fff;border-radius:12px;box-shadow:0 8px 18px rgba(16,24,40,0.15);width:min(360px, 80vw);overflow:hidden;text-decoration:none">
          <div style="position:relative;width:100%;height:140px">${imageBlock}
            <div style="${emphasizeStatus ? 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' : 'position:absolute;top:8px;left:8px;'}font-size:10px;padding:2px 6px;border-radius:999px;${emphasizeStatus ? 'background:rgba(222,106,74,0.75);color:#fff;border:1px solid #fff' : 'background:#DE6A4A;color:#fff;border:1px solid #fff'}">${statusText}</div>
          </div>
          <div style="padding:10px 12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <div style="font-size:14px;color:#0F4C81;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">${titleText}</div>
              <div style="font-size:14px;color:#111827;font-weight:700;flex-shrink:0">₱${priceNum}${monthly}</div>
            </div>
            <div style="margin-bottom:4px">
              ${locText ? `<div style="font-size:11px;color:#334155;display:inline-flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:#ea580c"><path d="M12 21s-8-4.5-8-11a8 8 0 1 1 16 0c0 6.5-8 11-8 11Z"/><circle cx="12" cy="10" r="3"/></svg><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">${locText}</span></div>` : ''}
              <div style="font-size:11px;color:#ea580c;font-weight:700;letter-spacing:.03em;margin-top:4px">${typeLabel}${subLabel ? ' — ' + subLabel : ''}</div>
              <div style="font-size:11px;color:#0F4C81;text-decoration:underline;margin-top:4px">View Property</div>
            </div>
          </div>
        </a>
      `;
      const m = L.marker([x.g.lat, x.g.lon], { icon: customIcon, listingId: String(x.l.id) } as any).addTo(mapObjRef.current);
      m.bindPopup(html, { maxWidth: 360, autoClose: false, closeButton: true });
      markersRef.current.push(m);
      bounds.extend([x.g.lat, x.g.lon]);
    }
    if (pts.length && !userHasInteractedRef.current) {
      isProgrammaticMoveRef.current = true;
      mapObjRef.current.fitBounds(bounds, { padding: [20, 20] });
      setTimeout(() => { isProgrammaticMoveRef.current = false; }, 0);
    }
  }, [viewMode, filtered, geocodes, leafletReady, mounted]);

  const isRentView = normalizedStatus === "for rent";
  const title = statusTitle ? `Properties for ${statusTitle}` : "Properties";
  const msgWordCount = inqMessage.trim().split(/\s+/).filter(Boolean).length;

  function handleSearch() {
    const qs = new URLSearchParams();
    if (typeSel && typeSel !== "All Types") qs.set("type", typeSel);
    if (typeSel === "Commercial Space") {
      if (commercialSubtypeSel) qs.set("commercialSubtype", commercialSubtypeSel);
      qs.delete("industrySubtype");
    } else if (typeSel === "Industrial Properties") {
      if (industrySubtypeSel) qs.set("industrySubtype", industrySubtypeSel);
      qs.delete("commercialSubtype");
    } else {
      qs.delete("commercialSubtype");
      qs.delete("industrySubtype");
    }
    const url = qs.toString() ? `/properties/${statusSlug}?${qs.toString()}` : `/properties/${statusSlug}`;
    router.replace(url);
    setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 0);
  }

  return (
    <div className="container pt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="mb-2">
            <div className="text-2xl font-semibold">{title}</div>
            <div className="text-sm text-black">Find your perfect home from our selection of premium properties.</div>
          </div>
          <div className="card mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="sm:col-span-2 md:col-span-2">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Location</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                  </span>
                  <input className="w-full rounded-md border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm" placeholder="Location, title, or developer..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') handleSearch(); }} />
                </div>
              </div>
              <div className="sm:col-span-2 md:col-span-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
                  <div>
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Property</div>
                    <select className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700" value={typeSel} onChange={e=>setTypeSel(e.target.value)}>
                      <option>All Types</option>
                      <option>Condominium</option>
                      <option>Town House</option>
                      <option>House and Lot</option>
                      {statusSlug.toLowerCase() !== "rfo" ? (
                        <option>Lot Only</option>
                      ) : null}
                      {statusSlug.toLowerCase() !== "rfo" && statusSlug.toLowerCase() !== "preselling" ? (
                        <option>Beach Property</option>
                      ) : null}
                      <option>Commercial Space</option>
                      <option>Industrial Properties</option>
                    </select>
                  </div>
                  <div className="mt-0 sm:mt-0 md:mt-2">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Sub Type</div>
                    {typeSel === "Commercial Space" ? (
                      <select className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700" value={commercialSubtypeSel} onChange={e=>setCommercialSubtypeSel(e.target.value)}>
                        <option value="">Any Subtype</option>
                        <option>Commercial Lot</option>
                        <option>Shop</option>
                        <option>Store</option>
                      </select>
                    ) : typeSel === "Industrial Properties" ? (
                      <select className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700" value={industrySubtypeSel} onChange={e=>setIndustrySubtypeSel(e.target.value)}>
                        <option value="">Any Subtype</option>
                        <option>Office Space</option>
                        <option>Warehouse</option>
                      </select>
                    ) : (
                      <select className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700" value="" disabled>
                        <option value="">Any Subtype</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
              <div className="sm:col-span-1 md:col-span-1">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Price Range</div>
                <div className="relative">
                  <select className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10" value={priceSel} onChange={e=>setPriceSel(e.target.value)}>
                    <option>Price Range</option>
                    <option>₱0–₱1M</option>
                    <option>₱1M–₱5M</option>
                    <option>₱5M–₱10M</option>
                    <option>₱10M+</option>
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
              <div className="sm:col-span-1 md:col-span-1 flex items-end">
                <button className="w-full btn-blue" onClick={handleSearch}>Search</button>
              </div>
            </div>
          </div>

  <div ref={resultsRef} className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
    <div className="flex items-center justify-between w-full sm:w-auto gap-3">
      <div className="text-sm font-medium text-slate-700">{isLoading ? "Loading properties..." : `Showing ${sorted.length} properties`}</div>
      <div className="flex flex-col items-center sm:hidden">
        <button type="button" onClick={()=> setViewMode(viewMode === "list" ? "map" : "list")} className={viewMode === "list" ? "relative inline-flex items-center h-8 px-10 rounded-full bg-green-600 text-white" : "relative inline-flex items-center h-8 px-10 rounded-full bg-orange-500 text-white"}>
          <span className={viewMode === "list" ? "absolute left-1.5 w-6 h-6 rounded-full bg-white shadow" : "absolute right-1.5 w-6 h-6 rounded-full bg-white shadow"}></span>
          <span className="font-semibold text-sm">{viewMode === "list" ? "List" : "Map"}</span>
        </button>
      </div>
    </div>
    
    <div className="flex items-center gap-3 w-full sm:w-auto">
      <div className="hidden sm:flex flex-col items-center">
        <button type="button" onClick={()=> setViewMode(viewMode === "list" ? "map" : "list")} className={viewMode === "list" ? "relative inline-flex items-center h-8 px-10 rounded-full bg-green-600 text-white" : "relative inline-flex items-center h-8 px-10 rounded-full bg-orange-500 text-white"}>
          <span className={viewMode === "list" ? "absolute left-1.5 w-6 h-6 rounded-full bg-white shadow" : "absolute right-1.5 w-6 h-6 rounded-full bg-white shadow"}></span>
          <span className="font-semibold text-sm">{viewMode === "list" ? "List" : "Map"}</span>
        </button>
        <div className="mt-1 text-[10px] text-slate-500">Toggle for Map view</div>
      </div>
      
      <div className="relative flex-1 sm:flex-initial">
        <select value={sortSel} onChange={e=>setSortSel(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10">
          <option>Sort by Recently Updated</option>
          <option>Sort by Price High to Low</option>
          <option>Sort by Price Low to High</option>
        </select>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    </div>
  </div>
          {viewMode === "map" ? (
            <div className="w-full h-[70vh] rounded overflow-hidden">
              <div ref={mapRootRef} className="w-full h-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading && Array.from({ length: 4 }).map((_,i)=>(
              <div key={i} className="card">
                <div className="w-full h-40 rounded bg-slate-200 mb-2" />
                <div className="h-4 w-48 rounded bg-slate-200 mb-1" />
                <div className="h-3 w-24 rounded bg-slate-200" />
              </div>
            ))}
            {sorted.map((l:any)=>{
              const beds = Number(l.bedrooms || 0);
              const baths = Number(l.bathrooms || 0);
              const areaVal = Number((l as any).floorArea ?? (l as any).area ?? 0);
              const imgUrl = Array.isArray(l.images)
                ? (l.images.map((i:any)=>i?.url).find((u:string)=>u && !/\.(mp4|webm|ogg)$/i.test((u.split("?" )[0]||u))) || "")
                : "";
              const priceText = mounted 
                ? (isRentView ? `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo` : `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                : "";
              const landmarks = Array.isArray(l.landmarks) ? l.landmarks.filter(Boolean) : [];
              const lid = String(l.id || "");
              const expanded = lid && expandedListings.includes(lid);
              const visibleLandmarks = expanded ? landmarks : landmarks.slice(0,3);
              const moreCount = expanded ? 0 : Math.max(0, landmarks.length - 3);
              const statusText = String(l.status || "");
              const emphasizeStatus = statusText === "Sold" || statusText === "Occupied";
              return (
                <Link prefetch={false} key={l.id} href={`/listing/${l.slug || l.id}`} className="card group transition-all duration-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:scale-[0.98] hover:ring-1 hover:ring-black/10">
                  <div className="relative w-full h-40 sm:h-48 mb-3 rounded overflow-hidden">
                    {imgUrl ? (
                      <Image src={imgUrl} alt={l.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 bg-slate-200 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-gray-500"><path d="M3 9.5l9-7 9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z"/><path d="M9 22V12h6v10"/></svg>
                      </div>
                    )}
                    <div
                      className={emphasizeStatus
                        ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm px-4 py-2 rounded-full text-white border border-white shadow-sm"
                          : "absolute top-2 left-2 text-xs px-3 py-1 rounded-full bg-[#DE6A4A] text-white border border-white shadow-sm"}
                      style={emphasizeStatus ? { backgroundColor: "rgba(222,106,74,0.75)" } : undefined}
                    >
                      {statusText}
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white font-bold">{priceText}</div>
                  </div>
                  <div className="text-base text-blue-800 font-semibold mb-1 truncate">{l.title}</div>
                  <div className="text-xs text-slate-600 mb-2 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-orange-500 shrink-0"><path d="M12 21s-8-4.5-8-11a8 8 0 1 1 16 0c0 6.5-8 11-8 11Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span className="truncate">{[l.address, l.city].filter(Boolean).join(", ")}</span>
                  </div>
                  <div className="border-t my-2" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 my-2">
                    {baths > 0 && (
                      <div className="rounded-lg bg-white shadow-sm border border-slate-100 px-2 py-1 group">
                        <div className="text-center text-[10px] font-semibold text-slate-500 uppercase">Bath</div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <div className="text-sm font-bold text-red-600 group-hover:text-blue-600">{baths}</div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 group-hover:text-red-600">
                            <path d="M6 12V8h10"/>
                            <path d="M10 6h4"/>
                            <path d="M16 8v3"/>
                            <path d="M16 15c0 1.1-.9 2-2 2s-2-.9-2-2c0-.9 1.2-2.3 2-3 0 0 2 2.1 2 3z"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    {beds > 0 && (
                      <div className="rounded-lg bg-white shadow-sm border border-slate-100 px-2 py-1 group">
                        <div className="text-center text-[10px] font-semibold text-slate-500 uppercase">Bed</div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <div className="text-sm font-bold text-red-600 group-hover:text-blue-600">{beds}</div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 group-hover:text-red-600"><path d="M3 7v11"/><rect x="7" y="11" width="14" height="7" rx="2"/><path d="M7 11V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2"/></svg>
                        </div>
                      </div>
                    )}
                    {Number((l as any).parking ?? 0) > 0 && (
                      <div className="rounded-lg bg-white shadow-sm border border-slate-100 px-2 py-1 group">
                        <div className="text-center text-[10px] font-semibold text-slate-500 uppercase">Parking</div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <div className="text-sm font-bold text-red-600 group-hover:text-blue-600"><span>{Number((l as any).parking ?? 0)}</span></div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 group-hover:text-red-600">
                            <path d="M2 16v-2h2l3-4h7l3 2h3a2 2 0 0 1 2 2v2H2Z"/>
                            <circle cx="7" cy="17" r="2"/>
                            <circle cx="17" cy="17" r="2"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    {Number((l as any).floorArea ?? (l as any).area ?? 0) > 0 && (
                      <div className="rounded-lg bg-white shadow-sm border border-slate-100 px-2 py-1 group">
                        <div className="text-center text-[10px] font-semibold text-slate-500 uppercase">Floor</div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <div className="text-sm font-bold flex items-baseline gap-1"><span className="text-red-600 group-hover:text-blue-600">{Number((l as any).floorArea ?? (l as any).area ?? 0)}</span><span className="text-[10px] text-slate-400">m²</span></div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 group-hover:text-red-600"><path d="M3 3h18v18H3z"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
                        </div>
                      </div>
                    )}
                    {Number((l as any).lotArea ?? 0) > 0 && (
                      <div className="rounded-lg bg-white shadow-sm border border-slate-100 px-2 py-1 group">
                        <div className="text-center text-[10px] font-semibold text-slate-500 uppercase">Lot</div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <div className="text-sm font-bold flex items-baseline gap-1"><span className="text-red-600 group-hover:text-blue-600">{Number((l as any).lotArea ?? 0)}</span><span className="text-[10px] text-slate-400">m²</span></div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600 group-hover:text-red-600"><path d="M3 3h18v18H3z"/></svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t my-2" />
                  {landmarks.length > 0 && (
                    <div className="text-xs text-slate-700 mb-1 font-semibold group-hover:text-blue-800 transition-colors">Nearby Landmarks</div>
                  )}
                  <div className="grid grid-cols-1 gap-1 mb-2">
                    {visibleLandmarks.map((lm:string, idx:number)=> (
                      <div key={idx} className="text-xs text-slate-700 inline-flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-orange-500">
                          <path d="M12 3a6 6 0 0 1 6 6c0 4.5-6 11-6 11S6 13.5 6 9a6 6 0 0 1 6-6"/>
                          <circle cx="12" cy="9" r="2"/>
                        </svg>
                        <span>{lm}</span>
                      </div>
                    ))}
                    {landmarks.length > 3 && (
                      <button
                        type="button"
                        className="text-xs text-orange-600 font-semibold text-left"
                        onClick={(e)=>{ e.preventDefault(); setExpandedListings(prev => expanded ? prev.filter(x=>x!==lid) : [...prev, lid]); }}
                      >
                        {expanded ? "Show less" : `+${moreCount} more`}
                      </button>
                    )}
                  </div>
                  <div className="border-t my-2" />
                  <div className="text-xs text-slate-700 mb-1"><span className="font-semibold text-black">Developer:</span> {l.developer || "N/A"}</div>
                  <div className="text-xs text-slate-700"><span className="font-semibold text-black">Property Type:</span> {(() => { const sub = l.type === "Industrial Properties" ? (l.industrySubtype || "") : l.type === "Commercial Space" ? (l.commercialSubtype || "") : ""; return sub ? `${l.type} — ${sub}` : l.type; })()}</div>
                  <div className="border-t my-2" />
                  
                </Link>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <div className="card col-span-1 md:col-span-2 text-center text-sm text-black py-6">SORRY NO PROPERTY AVAILABLE</div>
            )}
          </div>
          )}
        </div>
        <div className="lg:col-span-1">
          <div className="card">
            <div className="text-sm font-medium mb-2">{statusTitle ? `${statusTitle} Inquiry` : "Inquiry"}</div>
            <form
              onSubmit={async (e)=>{
                e.preventDefault();
                clearInqMessages();
                setInqLoading(true);
                try {
                  if (!inqEmail || !inqMessage) {
                    setInqError("Please provide email and message");
                  } else {
                    const r = await fetch("/api/rental-inquiry", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: inqName, email: inqEmail, phone: inqPhone, subject: inqSubject, message: inqMessage, status: statusTitle })
                    });
                    const d = await r.json();
                    setInqDev(Boolean(d?.dev));
                    if (!r.ok || d?.error) {
                      setInqError(d?.error || "Failed to send inquiry");
                      setTimeout(() => setInqError(null), 5000);
                    } else if (d?.alreadyExists) {
                      setInqSent(d.message || "You have already submitted an inquiry with this email.");
                      setInqName("");
                      setInqEmail("");
                      setInqPhone("");
                      setInqMessage("");
                      setTimeout(() => setInqSent(null), 5000);
                    } else {
                      setInqSent("Inquiry sent successfully");
                      setInqName("");
                      setInqEmail("");
                      setInqPhone("");
                      setInqMessage("");
                      setTimeout(() => setInqSent(null), 5000);
                    }
                  }
                } finally {
                  setInqLoading(false);
                }
              }}
              className="space-y-2"
            >
              <input className="input" placeholder="Your Name" value={inqName} onChange={e=>{setInqName(e.target.value); clearInqMessages();}} />
              <div className="space-y-1">
                <input 
                  className="input" 
                  placeholder="Email Address" 
                  value={inqEmail} 
                  onChange={e => handleInqEmailChange(e.target.value)} 
                />
                {inqEmailSuggestion && (
                  <div className="text-[10px] text-blue-600 px-1">
                    Did you mean <button type="button" className="font-bold underline" onClick={() => { setInqEmail(inqEmailSuggestion); setInqEmailSuggestion(null); clearInqMessages(); }}>{inqEmailSuggestion}</button>?
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <input className="input" placeholder="Phone Number" value={inqPhone} onChange={e=>{setInqPhone(autoCorrectPhone(e.target.value)); clearInqMessages();}} />
                <div className="text-[10px] text-slate-500 px-1">Format: 09XXXXXXXXX</div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-black">Subject *</label>
                <select className="input" required value={inqSubject} onChange={e=>{setInqSubject(e.target.value); clearInqMessages();}}>
                  <option value="">Select a topic</option>
                  <option>Buying</option>
                  <option>Selling</option>
                  <option>Renting</option>
                  <option>General Inquiry</option>
                </select>
              </div>
              <textarea
                className="input h-24"
                placeholder="Tell us about your rental needs, timeline, budget, or any specific questions you have..."
                value={inqMessage}
                onChange={e=>{
                  const v = e.target.value;
                  const ws = v.trim().split(/\s+/).filter(Boolean);
                  setInqMessage(ws.length > 300 ? ws.slice(0, 300).join(" ") : v);
                  clearInqMessages();
                }}
              />
              <div className={msgWordCount >= 270 ? "text-xs text-red-600 text-right" : "text-xs text-slate-500 text-right"}>{msgWordCount}/300 words</div>
              {inqError && <div className="text-red-600 text-xs cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setInqError(null)} title="Click to dismiss">{inqError}</div>}
              {inqSent && <div className="text-green-600 text-xs cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setInqSent(null)} title="Click to dismiss">{inqSent}</div>}
              {inqDev && <div className="text-orange-600 text-xs">Emails are not delivered in development. Configure SMTP to enable delivery.</div>}
              <button type="submit" className="btn-blue w-full text-center" disabled={inqLoading}>{inqLoading ? "Sending..." : "Send Inquiry"}</button>
            </form>
          </div>
          <div className="card shadow-md">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Quick Links</div>
            <div className="flex items-center rounded-md overflow-x-auto border border-gray-200 mb-4 scrollbar-hide" role="tablist" aria-label="Status Tabs">
              <button type="button" role="tab" aria-selected={selectedStatus === "for-sale"} aria-controls="property-type-panel-2" onClick={()=>{ setSelectedStatus("for-sale"); router.push("/properties/for-sale"); }} className={`flex-1 min-w-[100px] px-3 py-2 text-sm font-medium transition-colors ${selectedStatus === "for-sale" ? "bg-[#DE6A4A] text-white" : "bg-white text-slate-700 hover:bg-slate-50 border-r border-gray-200 last:border-0"}`}>For Sale</button>
              <button type="button" role="tab" aria-selected={selectedStatus === "for-rent"} aria-controls="property-type-panel-2" onClick={()=>{ setSelectedStatus("for-rent"); router.push("/properties/for-rent"); }} className={`flex-1 min-w-[100px] px-3 py-2 text-sm font-medium transition-colors ${selectedStatus === "for-rent" ? "bg-[#DE6A4A] text-white" : "bg-white text-slate-700 hover:bg-slate-50 border-r border-gray-200 last:border-0"}`}>For Rent</button>
              <button type="button" role="tab" aria-selected={selectedStatus === "preselling"} aria-controls="property-type-panel-2" onClick={()=>{ setSelectedStatus("preselling"); router.push("/properties/preselling"); }} className={`flex-1 min-w-[100px] px-3 py-2 text-sm font-medium transition-colors ${selectedStatus === "preselling" ? "bg-[#DE6A4A] text-white" : "bg-white text-slate-700 hover:bg-slate-50 border-r border-gray-200 last:border-0"}`}>Preselling</button>
              <button type="button" role="tab" aria-selected={selectedStatus === "rfo"} aria-controls="property-type-panel-2" onClick={()=>{ setSelectedStatus("rfo"); router.push("/properties/rfo"); }} className={`flex-1 min-w-[100px] px-3 py-2 text-sm font-medium transition-colors ${selectedStatus === "rfo" ? "bg-[#DE6A4A] text-white" : "bg-white text-slate-700 hover:bg-slate-50 border-r border-gray-200 last:border-0"}`}>RFO</button>
            </div>
            <div className="text-sm font-semibold mb-1">Property Category for {selectedStatusTitle || "Sale"}</div>
            <div
              id="property-type-header-2"
              aria-label="Tab Header"
              className="flex items-center justify-between text-sm text-slate-800 mb-2 cursor-pointer select-none"
              role="button"
              tabIndex={0}
              aria-expanded={showTypeMenu2}
              onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setShowTypeMenu2(prev=>!prev); }}
              onKeyDown={(e)=>{ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowTypeMenu2(prev=>!prev); } }}
            >
              <span>Property Type</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={showTypeMenu2 ? "w-4 h-4 text-slate-600 transition-transform duration-200 rotate-90" : "w-4 h-4 text-slate-600 transition-transform duration-200"}
              >
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
            {showTypeMenu2 ? (
              <div aria-labelledby="property-type-header-2" id="property-type-panel-2" role="tabpanel">
                <div className="space-y-2 text-sm text-slate-800">
                  <Link prefetch={false} href={`/properties/${selectedStatus}?type=Condominium`} className="block">Condominium</Link>
                  <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("House and Lot")}`} className="block">House and Lot</Link>
                  <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Town House")}`} className="block">Townhouse</Link>
                  {selectedStatus !== "rfo" && selectedStatus !== "preselling" ? (
                    <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Beach Property")}`} className="block">Beach Property</Link>
                  ) : null}
                  {selectedStatus !== "rfo" ? (
                    <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Lot Only")}`} className="block">Lot</Link>
                  ) : null}
                  {selectedStatus !== "rfo" && selectedStatus !== "preselling" ? (
                    <>
                      <div className="border-t my-2" />
                      <div
                        className="group flex items-center justify-between text-sm text-slate-800 cursor-pointer select-none transition-colors hover:text-[#7D677E] hover:bg-slate-50 rounded"
                        role="button"
                        tabIndex={0}
                        aria-expanded={showCommercialMenu2}
                        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setShowCommercialMenu2(prev=>!prev); }}
                        onKeyDown={(e)=>{ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowCommercialMenu2(prev=>!prev); } }}
                      >
                        <span>Commercial Property</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={showCommercialMenu2 ? "w-4 h-4 text-slate-600 transition-transform duration-200 rotate-90 group-hover:text-[#7D677E]" : "w-4 h-4 text-slate-600 transition-transform duration-200 group-hover:text-[#7D677E]"}><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                      {selectedStatus !== "rfo" && selectedStatus !== "preselling" && showCommercialMenu2 ? (
                        <>
                          <div className="border-t mb-2" />
                          <div className="space-y-2 text-sm text-slate-800">
                            <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Commercial Space")}&commercialSubtype=${encodeURIComponent("Commercial Lot")}`} className="block">Commercial Lot</Link>
                            <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Commercial Space")}&commercialSubtype=${encodeURIComponent("Shop")}`} className="block">Shop</Link>
                            <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Commercial Space")}&commercialSubtype=${encodeURIComponent("Store")}`} className="block">Store</Link>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {selectedStatus !== "rfo" && selectedStatus !== "preselling" ? (
                    <>
                      <div className="border-t my-2" />
                      <div
                        className="group flex items-center justify-between text-sm text-slate-800 cursor-pointer select-none transition-colors hover:text-[#7D677E] hover:bg-slate-50 rounded"
                        role="button"
                        tabIndex={0}
                        aria-expanded={showIndustrialMenu2}
                        onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setShowIndustrialMenu2(prev=>!prev); }}
                        onKeyDown={(e)=>{ if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setShowIndustrialMenu2(prev=>!prev); } }}
                      >
                        <span>Industrial Property</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={showIndustrialMenu2 ? "w-4 h-4 text-slate-600 transition-transform duration-200 rotate-90 group-hover:text-[#7D677E]" : "w-4 h-4 text-slate-600 transition-transform duration-200 group-hover:text-[#7D677E]"}><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                      {selectedStatus !== "rfo" && selectedStatus !== "preselling" && showIndustrialMenu2 ? (
                        <>
                          <div className="border-t mb-2" />
                          <div className="space-y-2 text-sm text-slate-800">
                            <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Industrial Properties")}&industrySubtype=${encodeURIComponent("Office Space")}`} className="block">Office Space</Link>
                            <Link prefetch={false} href={`/properties/${selectedStatus}?type=${encodeURIComponent("Industrial Properties")}&industrySubtype=${encodeURIComponent("Warehouse")}`} className="block">Warehouse</Link>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <MainFooterCards />
      </div>
    </div>
  );
}

export default function PropertiesByStatusPage({ params }: { params: Promise<{ status: string }> }) {
  return (
    <Suspense fallback={<div className="container pt-6">Loading properties...</div>}>
      <PropertiesByStatusPageContent params={params} />
    </Suspense>
  );
}
