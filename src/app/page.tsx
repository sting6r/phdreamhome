"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import MainFooterCards from "../components/MainFooterCards";
import Image from "next/image";

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
      // Only log errors if not aborted
      if (signal?.aborted) return null;
      const text = await r.text();
      console.error(`Home fetcher error [${r.status}]:`, u, text.slice(0, 100));
      return null;
    }
    return await r.json();
  } catch (e: any) {
    if (e?.name === "AbortError" || signal?.aborted) return null;
    if (e instanceof TypeError && (e.message === "Failed to fetch" || e.message.includes("aborted"))) {
      return null;
    }
    console.error("Home fetcher error:", u, e);
    return null;
  }
};

function toTitle(slug: string) {
  const s = (slug || "").trim().toLowerCase();
  if (!s) return "Properties";
  if (s === "rfo") return "RFO";
  return s.split("-").map(w => w.slice(0, 1).toUpperCase() + w.slice(1)).join(" ");
}

function HomePageContent() {
  const [listings, setListings] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<any | null>(null);

  React.useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    
    const loadData = async () => {
      try {
        const [listingsData, profileData] = await Promise.all([
          fetcher("/api/public-listings", controller.signal),
          fetcher("/api/public-profile", controller.signal)
        ]);
        
        if (!alive) return;
        
        if (listingsData) {
          setListings(listingsData.listings ?? []);
        }
        if (profileData) {
          setProfile(profileData);
        }
        setIsLoading(false);
      } catch (err: any) {
        if (!alive || err?.name === 'AbortError') return;
        console.error("Error loading home data:", err);
        setIsLoading(false);
      }
    };

    loadData();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const errorParam = searchParams.get("error");
  const errorCodeParam = searchParams.get("error_code");
  const errorDescParam = searchParams.get("error_description");

  // Handle OAuth errors redirected to the home page
  React.useEffect(() => {
    if (errorParam || errorCodeParam) {
      console.error("OAuth Error on Home:", errorParam, errorCodeParam);
      router.replace(`/4120626?error=${encodeURIComponent(errorDescParam || errorCodeParam || errorParam || "Authentication failed")}`);
    }
  }, [errorParam, errorCodeParam, errorDescParam, router]);

  const typeQuery = (searchParams.get("type") || "").trim();
  const [q, setQ] = React.useState("");
  const [typeSel, setTypeSel] = React.useState<string>(typeQuery || "All Types");
  const [statusSel, setStatusSel] = React.useState<string>("Status");
  const [minBeds, setMinBeds] = React.useState<string>("");
  const [minBaths, setMinBaths] = React.useState<string>("");
  const [priceSel, setPriceSel] = React.useState<string>("Price Range");
  const [activeQ, setActiveQ] = React.useState<string>("");
  const [activeType, setActiveType] = React.useState<string>(typeQuery || "All Types");
  const [activeStatus, setActiveStatus] = React.useState<string>("Status");
  const [activeMinBeds, setActiveMinBeds] = React.useState<string>("");
  const [activeMinBaths, setActiveMinBaths] = React.useState<string>("");
  const [activePrice, setActivePrice] = React.useState<string>("Price Range");
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
  async function geocodeOne(l: any) {
    const q = [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q || l.city || l.state || l.country || "Philippines")}`;
    const fallback = { lat: 12.8797, lon: 121.774 };
    try {
      const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "phdreamhome/1.0" } as any });
      const d = await r.json();
      const best = Array.isArray(d) ? d[0] : null;
      if (best && best.lat && best.lon) return { lat: Number(best.lat), lon: Number(best.lon) };
    } catch {}
    return fallback;
  }
  function parsePriceRange(s: string): [number|null, number|null] {
    const v = (s || "").trim();
    if (!v || v === "Price Range") return [null, null];
    if (/^₱0–₱1M$/.test(v)) return [0, 1_000_000];
    if (/^₱1M–₱5M$/.test(v)) return [1_000_000, 5_000_000];
    if (/^₱5M–₱10M$/.test(v)) return [5_000_000, 10_000_000];
    if (/^₱10M\+$/.test(v)) return [10_000_000, null];
    return [null, null];
  }
  const [minPrice, maxPrice] = parsePriceRange(activePrice);
  const normalizedType = activeType === "All Types" ? "" : activeType.trim().toLowerCase();
  const normalizedStatus = activeStatus === "Status" ? "" : activeStatus.trim().toLowerCase();
  const filteredListings = listings.filter((l:any)=>{
    const byType = normalizedType ? String(l.type || "").trim().toLowerCase() === normalizedType : true;
    const byStatus = normalizedStatus ? String(l.status || "").trim().toLowerCase() === normalizedStatus : true;
    const price = Number(l.price || 0);
    const byMinPrice = minPrice != null ? price >= minPrice : true;
    const byMaxPrice = maxPrice != null ? price <= maxPrice : true;
    const beds = Number(l.bedrooms || 0);
    const baths = Number(l.bathrooms || 0);
    const byBeds = activeMinBeds ? beds >= (activeMinBeds === "4+" ? 4 : Number(activeMinBeds)) : true;
    const byBaths = activeMinBaths ? baths >= (activeMinBaths === "4+" ? 4 : Number(activeMinBaths)) : true;
    const text = [l.title, l.address, l.city, l.developer].filter(Boolean).join(" ").toLowerCase();
    const byQ = activeQ ? text.includes(activeQ.toLowerCase()) : true;
    return byType && byStatus && byMinPrice && byMaxPrice && byBeds && byBaths && byQ;
  });
  const sortedListings = React.useMemo(() => {
    const arr = [...filteredListings];
    if (sortSel === "Sort by Price High to Low") {
      arr.sort((a:any,b:any)=> Number(b.price || 0) - Number(a.price || 0));
    } else if (sortSel === "Sort by Price Low to High") {
      arr.sort((a:any,b:any)=> Number(a.price || 0) - Number(b.price || 0));
    } else if (sortSel === "Sort by Recently Updated") {
      arr.sort((a:any,b:any)=> new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    }
    return arr;
  }, [filteredListings, sortSel]);
  function handleSearch() {
    setActiveQ(q);
    setActiveType(typeSel);
    setActiveStatus(statusSel);
    setActiveMinBeds(minBeds);
    setActiveMinBaths(minBaths);
    setActivePrice(priceSel);
    setQ("");
    setTypeSel("All Types");
    setStatusSel("Status");
    setMinBeds("");
    setMinBaths("");
    setPriceSel("Price Range");
  }
  function handleViewAll() {
    setActiveQ("");
    setActiveType("All Types");
    setActiveStatus("Status");
    setActiveMinBeds("");
    setActiveMinBaths("");
    setActivePrice("Price Range");
  }
  const hero = process.env.NEXT_PUBLIC_WELCOME_BG || (listings[0]?.images?.[0]?.url ?? "");
  const callBg = process.env.NEXT_PUBLIC_CALL_CARD_BG || "";
  const [expandedListings, setExpandedListings] = React.useState<string[]>([]);
  const featuredHeroItems = Array.isArray(listings)
    ? (listings
        .filter((l:any)=>!!l.featured)
        .map((l:any)=> {
          const url = Array.isArray(l.images)
            ? (l.images.map((i:any)=>i?.url).find((u:string)=>u && !/\.(mp4|webm|ogg)$/i.test(((u.split("?")[0]||u)))) || "")
            : "";
          const type = String(l.type || "");
          const status = String(l.status || "");
          return url ? { url, type, status } : null;
        })
        .filter(Boolean) as { url: string; type: string; status: string }[])
    : [];
  const presellingImages = Array.isArray(listings)
    ? listings
        .filter((l:any)=> String(l.status || "") === "Preselling" && !!l.featuredPreselling)
        .map((l:any)=> Array.isArray(l.images) ? (l.images.map((i:any)=>i?.url).find((u:string)=>u && !/\.(mp4|webm|ogg)$/i.test((u.split("?" )[0]||u))) || "") : "")
        .filter((u:string)=> !!u)
    : [];
  const [presellIndex, setPresellIndex] = React.useState(0);
  const [heroIndex, setHeroIndex] = React.useState(0);
  const [filterTop, setFilterTop] = React.useState<string>("6.75rem");
  React.useEffect(() => {
    if (featuredHeroItems.length > 1) {
      const t = setInterval(() => { setHeroIndex(i => (i + 1) % featuredHeroItems.length); }, 6000);
      return () => clearInterval(t);
    }
  }, [featuredHeroItems.length]);
  React.useEffect(() => {
    if (presellingImages.length > 1) {
      const t = setInterval(() => { setPresellIndex(i => (i + 1) % presellingImages.length); }, 5000);
      return () => clearInterval(t);
    }
  }, [presellingImages.length]);
  const prevPresell = () => { if (presellingImages.length > 0) setPresellIndex(i => (i - 1 + presellingImages.length) % presellingImages.length); };
  const nextPresell = () => { if (presellingImages.length > 0) setPresellIndex(i => (i + 1) % presellingImages.length); };
  React.useEffect(() => {
    function updateTop() {
      const el = typeof document !== "undefined" ? document.getElementById("status-links-wrapper") : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setFilterTop(`${Math.round(r.bottom)}px`);
    }
    updateTop();
    window.addEventListener("resize", updateTop, { passive: true } as any);
    window.addEventListener("scroll", updateTop, { passive: true } as any);
    return () => { window.removeEventListener("resize", updateTop as any); window.removeEventListener("scroll", updateTop as any); };
  }, []);
  React.useEffect(() => {
    if (viewMode !== "map") return;
    let alive = true;
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
      const missing = filteredListings.filter((l: any) => !geocodes[String(l.id || "")] );
      for (const l of missing) {
        const g = await geocodeOne(l);
        if (g) setGeocodes((prev) => ({ ...prev, [String(l.id || "")]: g }));
        await new Promise((res) => setTimeout(res, 300));
      }
    })();
    return () => { alive = false; };
  }, [viewMode, filteredListings, geocodes]);
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
    
    const pts = filteredListings.map((l: any) => ({ l, g: geocodes[String(l.id || "")] })).filter((x) => !!x.g);
    
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
    
    const customIcon = L.icon({ iconUrl: "/pins/marker.svg", iconSize: [32, 32], iconAnchor: [16, 30], popupAnchor: [0, -28] });
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
      const imageBlock = imgUrl
        ? `<img src="${imgUrl}" alt="${titleText}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
        : `<div style="position:absolute;inset:0;background:#e2e8f0"></div>`;
      const html = `
        <a href="/listing/${x.l.slug || x.l.id}" style="display:block;background:#fff;border-radius:12px;box-shadow:0 8px 18px rgba(16,24,40,0.15);width:360px;overflow:hidden;text-decoration:none">
          <div style="position:relative;width:100%;height:180px">${imageBlock}
            <div style="${emphasizeStatus ? 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' : 'position:absolute;top:8px;left:8px;'}font-size:12px;padding:4px 8px;border-radius:999px;${emphasizeStatus ? 'background:rgba(222,106,74,0.75);color:#fff;border:1px solid #fff' : 'background:#DE6A4A;color:#fff;border:1px solid #fff'}">${statusText}</div>
          </div>
          <div style="padding:14px 16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <div style="font-size:16px;color:#0F4C81;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">${titleText}</div>
              <div style="font-size:16px;color:#111827;font-weight:700;flex-shrink:0">₱${priceNum}${monthly}</div>
            </div>
            <div style="margin-bottom:6px">
              ${locText ? `<div style="font-size:12px;color:#334155;display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:#ea580c"><path d="M12 21s-8-4.5-8-11a8 8 0 1 1 16 0c0 6.5-8 11-8 11Z"/><circle cx="12" cy="10" r="3"/></svg><span>${locText}</span></div>` : ''}
              <div style="font-size:12px;color:#ea580c;font-weight:700;letter-spacing:.03em;margin-top:8px">${typeLabel}</div>
              <div style="font-size:12px;color:#0F4C81;text-decoration:underline;margin-top:6px">View Property</div>
            </div>
          </div>
        </a>
      `;
      const m = L.marker([x.g.lat, x.g.lon], { icon: customIcon, listingId: String(x.l.id) } as any).addTo(mapObjRef.current);
      m.bindPopup(html, { maxWidth: 380, autoClose: false, closeButton: true });
      markersRef.current.push(m);
      bounds.extend([x.g.lat, x.g.lon]);
    }
    if (pts.length && !userHasInteractedRef.current) {
      isProgrammaticMoveRef.current = true;
      mapObjRef.current.fitBounds(bounds, { padding: [20, 20] });
      setTimeout(() => { isProgrammaticMoveRef.current = false; }, 0);
    }
  }, [viewMode, filteredListings, geocodes, leafletReady, mounted]);
  
  function toStatusSlug(s: string) {
    const v = (s || "").trim().toLowerCase();
    if (!v) return "";
    if (v === "rfo") return "rfo";
    return v.replace(/\s+/g, "-");
  }
  const heroFinal = featuredHeroItems.length ? featuredHeroItems[heroIndex].url : hero;
  const [baseHero, setBaseHero] = React.useState<string | null>(heroFinal || null);
  const [fadeHero, setFadeHero] = React.useState<string | null>(null);
  const [isFading, setIsFading] = React.useState(false);
  React.useEffect(() => {
    if (!heroFinal) return;
    if (baseHero === heroFinal) return;
    setFadeHero(heroFinal);
    setIsFading(true);
    const t = setTimeout(() => { setBaseHero(heroFinal); setIsFading(false); setFadeHero(null); }, 700);
    return () => clearTimeout(t);
  }, [heroFinal, baseHero]);
  const countHeroes = featuredHeroItems.length;
  const prevHero = () => { if (countHeroes > 0) setHeroIndex(i => (i - 1 + countHeroes) % countHeroes); };
  const nextHero = () => { if (countHeroes > 0) setHeroIndex(i => (i + 1) % countHeroes); };
  
  return (
    <div className="space-y-10">
      <div className="container pt-4">
        <div className="relative h-[50vh] sm:h-[60vh] rounded-md overflow-hidden">
          <div
            className="absolute inset-0 bg-center bg-no-repeat bg-contain sm:bg-cover"
            style={{ backgroundImage: baseHero ? `url(${baseHero})` : undefined }}
          />
          {fadeHero && (
            <div
              className={`absolute inset-0 bg-center bg-no-repeat bg-contain sm:bg-cover transition-opacity duration-700 ${isFading ? "opacity-100" : "opacity-0"}`}
              style={{ backgroundImage: `url(${fadeHero})` }}
            />
          )}
          <div className="absolute inset-0 bg-black/20" />
          {featuredHeroItems.length ? (
            <Link
              prefetch={false}
              href={`/properties/${toStatusSlug(featuredHeroItems[heroIndex].status)}?type=${encodeURIComponent(featuredHeroItems[heroIndex].type)}`}
              className="absolute inset-0 z-30"
            >
              <span className="sr-only">Open properties</span>
            </Link>
          ) : null}
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end pb-10 sm:pb-14">
            <div className="container text-center space-y-1">
              <div className="text-white text-3xl sm:text-4xl font-bold">Welcome to Your Dream Home</div>
              <div className="text-white text-sm sm:text-base">Transforming dreams into homes, one step at a time.</div>
            </div>
          </div>
          {countHeroes > 1 && (
            <>
            <button type="button" onClick={prevHero} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-auto bg-white/70 hover:bg-white text-black opacity-70 rounded-full w-8 h-8 flex items-center justify-center shadow">‹</button>
              <button type="button" onClick={nextHero} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 pointer-events-auto bg-white/70 hover:bg-white text-black opacity-70 rounded-full w-8 h-8 flex items-center justify-center shadow">›</button>
            </>
          )}
        </div>
      </div>
      {profile && (
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            <div className="card relative overflow-hidden min-h-16 w-full h-full hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:scale-[0.98] hover:ring-1 hover:ring-black/10 transition-all duration-300" style={{ backgroundColor: '#F9F5FF' }}>
              <div className="relative p-3 sm:p-4 text-black">
                <div className="flex flex-col sm:flex-row items-center sm:items-center justify-center gap-3 sm:gap-6">
                  <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-full overflow-hidden bg-transparent relative flex-shrink-0 sm:ml-4">
                    {profile.imageUrl ? (
                      <Image 
                        src={profile.imageUrl} 
                        alt={profile.name || "Agent"} 
                        fill 
                        sizes="(min-width: 640px) 11rem, 10rem" 
                        className="object-cover"
                        onError={(e) => {
                          console.error("Home: Profile image failed to load:", profile.imageUrl);
                          setProfile({...profile, imageUrl: null});
                        }}
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-gray-500"><circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <div className="text-xl sm:text-2xl font-semibold capitalize">{profile.name || "Agent"}</div>
                      {profile.verified ? (
                        <div className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2l2.4 2.4L17 4l1 2.6L21 8l-1.6 2.6.6 2.8-2.6.9-1.4 2.5-2.8-.6L12 19l-2.6-1.6-2.8.6-1.4-2.5-2.6-.9.6-2.8L3 8l3-1.4L7 4l2.6.4L12 2zm0 5l-4 4 1.4 1.4L12 10.8l4.6 4.6L18 14l-6-6z"/></svg>
                          <span>Verified</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-700 uppercase tracking-wider">{(profile.role || "").toUpperCase() || "REAL ESTATE BROKER"}</div>
                    {profile.licenseNo ? (
                      <div className="text-sm text-slate-800"><span className="font-bold">PRC Accred. No:</span> {profile.licenseNo}</div>
                    ) : null}
                    {profile.dhsudAccredNo ? (
                      <div className="text-sm text-slate-800"><span className="font-bold">DHSUD Accred. No:</span> {profile.dhsudAccredNo}</div>
                    ) : null}
                    <div className="flex flex-col items-center sm:items-start gap-1 mt-2">
                      {profile.phone ? (
                        <div className="flex items-center gap-2 text-sm text-slate-800"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-green-600"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12 .88.33 1.74.62 2.56a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 7 7l.61-.28a2 2 0 0 1 2.11-.45c.82 .29 1.68 .5 2.56 .62A2 2 0 0 1 22 16.92z"/></svg>{profile.phone}</div>
                      ) : null}
                      {profile.email ? (
                        <div className="flex items-center gap-2 text-sm text-slate-800"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-blue-600"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>{profile.email}</div>
                      ) : null}
                    </div>
                    <div className="text-sm mt-1"><span className="text-lg font-bold text-green-700">{profile.totalListings ?? 0}</span> Total Listings</div>
                    <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                      <Link prefetch={false} href="/contact" className="inline-flex items-center gap-2 rounded-md bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-500 shadow-sm transition-all active:scale-95">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2h-3l-4 4v-4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9z"/></svg>
                        <span>Send Inquiry</span>
                      </Link>
                      <button
                        className="inline-flex items-center gap-2 rounded-md bg-slate-100 text-slate-800 px-4 py-2 text-sm hover:bg-slate-200 transition-all active:scale-95"
                        onClick={() => { try { navigator.clipboard.writeText(`${window.location.origin}/`); } catch {} }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M8 7h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M16 3H6a2 2 0 0 0-2 2v10"/></svg>
                        <span>Copy Link</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card relative overflow-hidden min-h-[200px] lg:min-h-16 w-full h-full hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:scale-[0.98] hover:ring-1 hover:ring-black/10 transition-all duration-300">
              {presellingImages.length ? (
                <>
                  <Link prefetch={false} href="/properties/preselling" className="absolute inset-0 block">
                    <Image 
                      src={presellingImages[presellIndex]} 
                      alt="Preselling Property" 
                      fill 
                      className="object-cover" 
                      onError={() => {
                        console.error("Home: Preselling image failed to load:", presellingImages[presellIndex]);
                      }}
                    />
                  </Link>
                  {presellingImages.length > 1 && (
                    <>
                      <button type="button" onClick={prevPresell} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 text-black rounded-full w-8 h-8 flex items-center justify-center">‹</button>
                      <button type="button" onClick={nextPresell} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/80 text-black rounded-full w-8 h-8 flex items-center justify-center">›</button>
                    </>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 bg-slate-200" />
              )}
              <div className="absolute top-2 left-2 z-10 px-3 py-1 rounded bg-black/60 text-white text-xs sm:text-sm pointer-events-none">Featured Preselling Properties</div>
            </div>
          </div>
        </div>
      )}
      <div className="container">
        <div className="card space-y-2 sticky z-30" style={{ top: filterTop }}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 sm:gap-3 items-end">
            <div className="md:col-span-4">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Location</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                </span>
                <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') handleSearch(); }} className="w-full rounded-md border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm text-gray-700 shadow-sm" placeholder=" Enter Location, Name, or Developer" />
              </div>
            </div>
            <div>
              <button className="btn-blue w-full" onClick={handleSearch}>Search</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 items-end">
            <div className="relative">
              <select value={statusSel} onChange={e=>setStatusSel(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10"><option>Status</option><option>For Sale</option><option>For Rent</option><option>Preselling</option><option>RFO</option></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div className="relative">
              <select value={typeSel} onChange={e=>setTypeSel(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10"><option>All Types</option><option>Condominium</option><option>Town House</option><option>House and Lot</option><option>Lot Only</option><option>Commercial Space</option><option>Industrial Properties</option><option>Beach Property</option></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div className="relative">
              <select value={minBeds} onChange={e=>setMinBeds(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10"><option>No. of Beds</option><option>1</option><option>2</option><option>3</option><option>4+</option></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div className="relative">
              <select value={minBaths} onChange={e=>setMinBaths(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10"><option>No. of Baths</option><option>1</option><option>2</option><option>3</option><option>4+</option></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div className="relative">
              <select value={priceSel} onChange={e=>setPriceSel(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10"><option>Price Range</option><option>₱0–₱1M</option><option>₱1M–₱5M</option><option>₱5M–₱10M</option><option>₱10M+</option></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </div>
      <div className="container">
        <div className="text-center mb-4">
          <div className="text-2xl font-semibold">Featured Properties</div>
          <div className="text-sm text-black">Discover handpicked listings curated to represent the best.</div>
        </div>
      </div>
      <div className="container">
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 sm:mb-2">
          <div className="order-2 sm:order-1 flex-1 text-sm text-black text-center sm:text-left">Total Properties: {sortedListings.length}</div>
          <div className="order-1 sm:order-2 flex-1 flex flex-col items-center">
            <button
              type="button"
              onClick={()=> setViewMode(viewMode === "list" ? "map" : "list")}
              className={viewMode === "list" ? "relative inline-flex items-center h-8 px-10 rounded-full bg-green-600 text-white" : "relative inline-flex items-center h-8 px-10 rounded-full bg-orange-500 text-white"}
            >
              <span className={viewMode === "list" ? "absolute left-1.5 w-6 h-6 rounded-full bg-white shadow" : "absolute right-1.5 w-6 h-6 rounded-full bg-white shadow"}></span>
              <span className="font-semibold text-sm">{viewMode === "list" ? "List" : "Map"}</span>
            </button>
            <div className="mt-1 text-[10px] sm:text-xs text-slate-600">Toggle button to view Map</div>
          </div>
          <div className="order-3 sm:order-3 flex-1 flex justify-center sm:justify-end w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <select value={sortSel} onChange={e=>setSortSel(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm appearance-none pr-10"><option>Sort by Recently Updated</option><option>Sort by Price High to Low</option><option>Sort by Price Low to High</option></select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </div>
      {viewMode === "map" ? (
        <div className="container">
          {!isLoading && filteredListings.length === 0 && (
            <div className="mb-2">
              <div className="card text-center text-sm text-black py-6">SORRY NO PROPERTY AVAILABLE</div>
            </div>
          )}
          <div className="relative z-0 w-full h-[70vh] rounded overflow-hidden">
            <div ref={mapRootRef} className="w-full h-full" />
          </div>
        </div>
      ) : (
        <div className="grid-list">
        {isLoading && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card">
              <div className="w-full h-48 mb-3 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-200 mb-2" />
              <div className="h-3 w-40 rounded bg-slate-200 mb-1" />
              <div className="h-3 w-28 rounded bg-slate-200" />
            </div>
          ))
        )}
        {sortedListings.map((l:any) => {
          const beds = Number(l.bedrooms || 0);
          const baths = Number(l.bathrooms || 0);
          const areaVal = Number((l as any).area ?? l.floorArea ?? 0);
          const imgUrl = Array.isArray(l.images)
            ? (l.images.map((i:any)=>i?.url).find((u:string)=>u && !/\.(mp4|webm|ogg)$/i.test((u.split("?" )[0]||u))) || "")
            : "";
          const landmarks = Array.isArray(l.landmarks) ? l.landmarks.filter(Boolean) : [];
          const lid = String(l.id || "");
          const expanded = lid && expandedListings.includes(lid);
          const visibleLandmarks = expanded ? landmarks : landmarks.slice(0,3);
          const moreCount = expanded ? 0 : Math.max(0, landmarks.length - 3);
          const statusText = String(l.status || "");
          const emphasizeStatus = statusText === "Sold" || statusText === "Occupied";
          const propertySlug = l.slug || l.id;
          return (
          <Link prefetch={false} key={l.id} href={`/listing/${propertySlug}`} className="card group transition-all duration-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:scale-[0.98] hover:ring-1 hover:ring-black/10">
            <div className="relative w-full h-32 sm:h-48 mb-3 rounded overflow-hidden">
              {imgUrl ? (
                <Image src={imgUrl} alt={l.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
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
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white font-bold">{mounted ? `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</div>
            </div>
            <div className="text-base text-blue-800 font-medium mb-1">{l.title}</div>
            <div className="text-xs text-slate-700 mb-2 inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-orange-500"><path d="M12 21s-8-4.5-8-11a8 8 0 1 1 16 0c0 6.5-8 11-8 11Z"/><circle cx="12" cy="10" r="3"/></svg>
              {[l.address, l.city].filter(Boolean).join(", ")}
            </div>
            <div className="border-t my-2" />
            
            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 my-2">
              {baths > 0 && (
                <div className="rounded-lg bg-white shadow px-2 py-1 group">
                  <div className="text-center text-xs font-semibold text-slate-700">Bathroom</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <div className="text-sm font-semibold text-red-600 group-hover:text-blue-600">{baths}</div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600 group-hover:text-red-600">
                      <path d="M6 12V8h10"/>
                      <path d="M10 6h4"/>
                      <path d="M16 8v3"/>
                      <path d="M16 15c0 1.1-.9 2-2 2s-2-.9-2-2c0-.9 1.2-2.3 2-3 0 0 2 2.1 2 3z"/>
                    </svg>
                  </div>
                </div>
              )}
              {beds > 0 && (
                <div className="rounded-lg bg-white shadow px-2 py-1 group">
                  <div className="text-center text-xs font-semibold text-slate-700">Bedroom</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <div className="text-sm font-semibold text-red-600 group-hover:text-blue-600">{beds}</div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600 group-hover:text-red-600"><path d="M3 7v11"/><rect x="7" y="11" width="14" height="7" rx="2"/><path d="M7 11V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2"/></svg>
                  </div>
                </div>
              )}
              {Number((l as any).parking ?? 0) > 0 && (
                <div className="rounded-lg bg-white shadow px-2 py-1 group">
                  <div className="text-center text-xs font-semibold text-slate-700">Parking</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <div className="text-sm font-semibold text-red-600 group-hover:text-blue-600"><span>{Number((l as any).parking ?? 0)}</span></div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600 group-hover:text-red-600">
                      <path d="M2 16v-2h2l3-4h7l3 2h3a2 2 0 0 1 2 2v2H2Z"/>
                      <circle cx="7" cy="17" r="2"/>
                      <circle cx="17" cy="17" r="2"/>
                    </svg>
                  </div>
                </div>
              )}
              {Number((l as any).floorArea ?? (l as any).area ?? 0) > 0 && (
                <div className="rounded-lg bg-white shadow px-2 py-1 group">
                  <div className="text-center text-xs font-semibold text-slate-700">Floor Area</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <div className="text-sm font-semibold flex items-baseline gap-1"><span className="text-red-600 group-hover:text-blue-600">{Number((l as any).floorArea ?? (l as any).area ?? 0)}</span><span className="text-xs text-slate-500">Sq.M.</span></div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600 group-hover:text-red-600"><path d="M3 3h18v18H3z"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
                  </div>
                </div>
              )}
              {Number((l as any).lotArea ?? 0) > 0 && (
                <div className="rounded-lg bg-white shadow px-2 py-1 group">
                  <div className="text-center text-xs font-semibold text-slate-700">Lot Area</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <div className="text-sm font-semibold flex items-baseline gap-1"><span className="text-red-600 group-hover:text-blue-600">{Number((l as any).lotArea ?? 0)}</span><span className="text-xs text-slate-500">Sq.M.</span></div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600 group-hover:text-red-600"><path d="M3 3h18v18H3z"/></svg>
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
            <div className="text-xs text-slate-700"><span className="font-semibold text-black">Property Type:</span> {l.type}</div>
            <div className="border-t my-2" />
            <div className="mt-3 flex items-center justify-center">
              <span className="btn-blue inline-flex items-center justify-center rounded-full px-4 py-1 text-sm">
                View Details
              </span>
            </div>
          </Link>
          );
        })}
        {!isLoading && filteredListings.length === 0 && (
          <div className="card text-center text-sm text-black py-6 col-span-1 sm:col-span-2 lg:col-span-3">SORRY NO PROPERTY AVAILABLE</div>
        )}
      </div>
      )}
      
      <div className="container text-center">
        <a href="#" onClick={(e)=>{ e.preventDefault(); handleViewAll(); }} className="text-black text-sm">View All Properties</a>
      </div>

      <div className="container">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-2xl sm:text-3xl font-bold mb-2">Our Services</div>
          <div className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">Comprehensive real estate solutions tailored to your unique needs.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
          <div className="card text-center space-y-3 shadow-md hover:shadow-lg transition-shadow py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M3 9.5l9-7 9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z"/><path d="M9 22V12h6v10"/></svg>
            </div>
            <div className="font-semibold text-lg">Property Sales</div>
            <div className="text-sm text-gray-600 px-4">Expert guidance through every step of buying or selling property.</div>
            <Link prefetch={false} href="/properties/for-sale" className="text-blue-600 text-sm font-medium hover:underline inline-flex items-center gap-1">
              Learn More <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          </div>
          <div className="card text-center space-y-3 shadow-md hover:shadow-lg transition-shadow py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </div>
            <div className="font-semibold text-lg">Rental Services</div>
            <div className="text-sm text-gray-600 px-4">Find the perfect rental property or manage your investments.</div>
            <Link prefetch={false} href="/properties/for-rent" className="text-blue-600 text-sm font-medium hover:underline inline-flex items-center gap-1">
              Learn More <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          </div>
          <div className="card text-center space-y-3 shadow-md hover:shadow-lg transition-shadow py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><circle cx="12" cy="12" r="5"/><path d="M2 12h20"/></svg>
            </div>
            <div className="font-semibold text-lg">Market Analysis</div>
            <div className="text-sm text-gray-600 px-4">Data-driven insights to help you make informed decisions.</div>
            <Link prefetch={false} href="/blog" className="text-blue-600 text-sm font-medium hover:underline inline-flex items-center gap-1">
              Learn More <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          </div>
        </div>
        <MainFooterCards />
      </div>
      
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="container pt-6">Loading...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
