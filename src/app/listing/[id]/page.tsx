import { prisma, withRetry } from "@lib/prisma";
import Image from "next/image";
import Link from "next/link";
import MainFooterCards from "@components/MainFooterCards";
import { createSignedUrl, supabaseAdmin } from "@lib/supabase";
import type { Metadata } from "next";
import GalleryViewer from "@components/GalleryViewer";
import SimilarCarousel from "@components/SimilarCarousel";
import ContactAgentCard from "@components/ContactAgentCard";
import PropertyCalculator from "@components/PropertyCalculator";
import QuickLinksSelector from "@components/QuickLinksSelector";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let listing;
  try {
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
    listing = await Promise.race([
      withRetry(() => prisma.listing.findFirst({ 
        where: { OR: [{ id }, { slug: id }] },
        include: { images: { take: 1 } }
      }), 1, 0),
      timeout(2500)
    ]);
  } catch (e) {
    if (e instanceof Error && e.message === "Timeout") {
      console.warn("Metadata Prisma timeout, falling back to Supabase Admin");
    } else {
      console.error("Metadata Prisma error, fallback:", e);
    }
    const { data } = await supabaseAdmin.from('Listing').select('*, images:ListingImage(*)').or(`id.eq.${id},slug.eq.${id}`).single();
    if (data) {
       listing = data;
       // Sort/limit images if needed, though take:1 is for optimization
       if (listing.images && Array.isArray(listing.images)) listing.images = listing.images.slice(0, 1);
    }
  }
  
  if (!listing || !listing.published) return { title: "Listing not found" };
  
  const title = listing.seoTitle || `${listing.title} | PhDreamHome`;
  const description = listing.seoDescription || listing.description?.slice(0, 160) || `Check out this ${listing.type} in ${listing.city}, ${listing.state}.`;
  const keywords = Array.isArray((listing as any).seoKeywords) && (listing as any).seoKeywords.length 
    ? (listing as any).seoKeywords 
    : [listing.type, listing.city, "Philippines real estate", "property for sale"].filter(Boolean);

  const ogImage = listing.images[0]?.url ? (await createSignedUrl(listing.images[0].url)) : "https://www.phdreamhome.com/logo.svg";

  return { 
    title, 
    description, 
    keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://www.phdreamhome.com/listing/${listing.slug || listing.id}`,
      images: [
        {
          url: ogImage || "",
          width: 1200,
          height: 630,
          alt: listing.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage || ""],
    },
    alternates: {
      canonical: `https://www.phdreamhome.com/listing/${listing.slug || listing.id}`,
    },
  };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ price?: string; dp?: string; rate?: string; term?: string; sp?: string }> }) {
  const { id } = await params;
  const sParams = await searchParams;
  let listing;
  try {
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
    listing = await Promise.race([
      withRetry(() => prisma.listing.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        include: { 
          images: { orderBy: { sortOrder: "asc" } }, 
          user: { 
            select: { 
              name: true,
              email: true, 
              phone: true,
              image: true,
              role: true,
              licenseNo: true,
              dhsudAccredNo: true
            } 
          } 
        }
      }), 1, 0),
      timeout(2500)
    ]);
  } catch (e) {
    if (e instanceof Error && e.message === "Timeout") {
      console.warn("ListingPage Prisma timeout, falling back to Supabase Admin");
    } else {
      console.error("ListingPage Prisma error, fallback:", e);
    }
    const { data } = await supabaseAdmin
      .from('Listing')
      .select('*, images:ListingImage(*), user:User(name, email, phone, image, role, licenseNo, dhsudAccredNo)')
      .or(`id.eq.${id},slug.eq.${id}`)
      .single();
      
    if (data) {
      listing = data;
      // Sort images
      if (listing.images && Array.isArray(listing.images)) {
        listing.images.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
      // User might be array or object depending on relation type, usually object for many-to-one
      if (typeof listing.user === 'string') {
        console.error("Invalid user type (string) received for listing:", listing.id);
        listing.user = null;
      } else if (Array.isArray(listing.user)) {
        listing.user = listing.user[0];
      }
    }
  }

  if (!listing || !listing.published) return <div>Not found</div>;
  const items = (await Promise.all(listing.images.map(async (i: any) => (await createSignedUrl(i.url)) || null)))
    .filter((u): u is string => !!u)
    .map(u => ({ url: u }));
  
  // Ensure listing.user is an object before spreading or accessing properties
  const userData = (listing.user && typeof listing.user === 'object') ? listing.user : {};
  const agentImageUrl = userData.image ? (await createSignedUrl(userData.image)) : null;
  const agent = { ...userData, imageUrl: agentImageUrl };

  const typeText = (() => { const sub = listing.type === "Industrial Properties" ? (listing.industrySubtype || "") : listing.type === "Commercial Space" ? (listing.commercialSubtype || "") : ""; return sub ? `${listing.type} — ${sub}` : listing.type; })();
  const indoor = Array.isArray(listing.indoorFeatures) ? listing.indoorFeatures.filter(Boolean) : [];
  const outdoor = Array.isArray(listing.outdoorFeatures) ? listing.outdoorFeatures.filter(Boolean) : [];
  const priceCalc = Number((sParams?.price ?? listing.price ?? 0) as any) || 0;
  const dpStr = String(sParams?.dp ?? "").trim();
  let dpAmount = 0; let dpPercent = 20;
  if (dpStr) {
    const m = dpStr.match(/^(\d+(?:\.\d+)?)\s*%?$/);
    if (m) {
      const v = Number(m[1]);
      if (dpStr.includes("%") || v <= 100) { dpPercent = v; dpAmount = priceCalc * v / 100; }
      else { dpAmount = v; dpPercent = priceCalc ? (v / priceCalc) * 100 : 0; }
    } else {
      const v = Number(dpStr);
      if (!isNaN(v)) { if (dpStr.includes("%") || v <= 100) { dpPercent = v; dpAmount = priceCalc * v / 100; } else { dpAmount = v; dpPercent = priceCalc ? v / priceCalc * 100 : 0; } }
    }
  } else { dpAmount = priceCalc * dpPercent / 100; }
  const ratePercent = Number((sParams?.rate ?? 5) as any) || 5;
  const termYears = Number((sParams?.term ?? 20) as any) || 20;
  const loanable = Math.max(0, priceCalc - dpAmount);
  const r = ratePercent / 100 / 12; const n = Math.max(1, termYears * 12);
  const monthlyPayment = loanable && r > 0 ? (loanable * r) / (1 - Math.pow(1 + r, -n)) : (loanable / n);
  const grossMonthlySuggested = monthlyPayment / 0.4;
  const perPage = 12;
  const spNum = Number((sParams?.sp ?? 1) as any) || 1;
  const page = Math.max(1, spNum);
  const skip = (page - 1) * perPage;
  const similarWhere = {
    published: true,
    NOT: { id: listing.id },
    OR: [
      ...(listing.city ? [{ city: listing.city }] : []),
      ...(listing.type ? [{ type: listing.type }] : [])
    ]
  };

  let totalSimilar = 0;
  try {
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
    totalSimilar = await Promise.race([
      withRetry(() => prisma.listing.count({ where: similarWhere }), 1, 0),
      timeout(8000)
    ]) as number;
  } catch (e) {
    console.error("Similar listings count Prisma error, fallback:", e);
    const { count, error } = await supabaseAdmin
      .from('Listing')
      .select('*', { count: 'exact', head: true })
      .match({ published: true })
      .not('id', 'eq', listing.id)
      .or(`city.eq.${listing.city},type.eq.${listing.type}`);
    
    if (!error) totalSimilar = count || 0;
  }

  let similarRaw = [];
  try {
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
    similarRaw = await Promise.race([
      withRetry(() => prisma.listing.findMany({
        where: similarWhere,
        include: { images: { orderBy: { sortOrder: "asc" } } },
        orderBy: { updatedAt: "desc" },
        skip,
        take: perPage
      }), 1, 0),
      timeout(10000)
    ]) as any[];
  } catch (e) {
    if (e instanceof Error && e.message === "Timeout") {
      console.warn("Similar listings Prisma timeout, falling back to Supabase Admin");
    } else {
      console.error("Similar listings Prisma error, fallback:", e);
    }
    const { data } = await supabaseAdmin
      .from('Listing')
      .select('*, images:ListingImage(*)')
      .match({ published: true })
      .not('id', 'eq', listing.id)
      .or(`city.eq.${listing.city},type.eq.${listing.type}`)
      .order('updatedAt', { ascending: false })
      .range(skip, skip + perPage - 1);
    
    if (data) {
      similarRaw = data.map((l: any) => {
        if (l.images && Array.isArray(l.images)) {
          l.images.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        }
        return l;
      });
    }
  }
  const similar = await Promise.all(similarRaw.map(async (l: any) => {
    // Only sign the first image URL for similar properties to save time/requests
    const firstImageUrl = l.images[0]?.url;
    const imageUrl = firstImageUrl ? (await createSignedUrl(firstImageUrl)) || "" : "";
    const imageCount = l.images.length;
    return { ...l, imageUrl, imageCount } as any;
  }));
  const pricePhpText = `Php ${Number(listing.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const locationText = [listing.address, listing.city, listing.state, listing.country].filter(Boolean).join("  ");
  const floorAreaText = Number(listing.floorArea) > 0 ? `${Number(listing.floorArea)} Sq.M.` : "N/A";
  const mapQuery = locationText || "Philippines";
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=en&z=15&output=embed`;
  const totalPages = Math.max(1, Math.ceil(totalSimilar / perPage));
  const baseQs = (() => {
    const q = new URLSearchParams();
    if (sParams?.price) q.set("price", String(sParams.price));
    if (sParams?.dp) q.set("dp", String(sParams.dp));
    if (sParams?.rate) q.set("rate", String(sParams.rate));
    if (sParams?.term) q.set("term", String(sParams.term));
    return q;
  })();
  const pageUrlCanonical = `https://www.phdreamhome.com/listing/${id}`;
  const description = listing.seoDescription || listing.description?.slice(0, 160) || `Check out this ${listing.type} in ${listing.city}, ${listing.state}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": listing.title,
    "description": description,
    "url": pageUrlCanonical,
    "image": items.map(i => i.url),
    "address": {
      "@type": "PostalAddress",
      "addressLocality": listing.city,
      "addressRegion": listing.state,
      "addressCountry": "PH",
      "streetAddress": listing.address
    },
    "offers": {
      "@type": "Offer",
      "price": listing.price,
      "priceCurrency": "PHP",
      "availability": "https://schema.org/InStock"
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.length ? <GalleryViewer items={items} title={listing.title} address={[listing.address, listing.city, listing.country].filter(Boolean).join(", ")} price={Number(listing.price)} /> : (
            <div className="relative w-full h-72 rounded-md overflow-hidden">
              <div className="absolute inset-0 bg-slate-200 rounded flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-16 h-16 text-gray-500"><path d="M3 9.5l9-7 9 7V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5Z"/><path d="M9 22V12h6v10"/></svg>
              </div>
            </div>
          )}
          <div className="rounded-md bg-[#FAF7FD] p-3 sm:p-4 border border-slate-300 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div className="text-lg sm:text-xl font-bold tracking-wide">OVERVIEW</div>
              <Link href="/contact" className="inline-flex items-center rounded border border-red-500 text-red-600 px-3 py-1 text-sm w-full sm:w-auto justify-center">Do you want this Property?</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Number(listing.bathrooms) > 0 && (
                <div className="rounded-lg bg-white shadow-sm px-3 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-700"><span>Bathroom</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-sky-700">
                      <path d="M4 11h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5Z"/>
                      <path d="M8 11V8a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v3"/>
                      <path d="M5 18v2"/>
                      <path d="M19 18v2"/>
                      <path d="M9 6h6"/>
                      <path d="M15 6l2 2"/>
                      <path d="M14 10v2"/>
                      <path d="M16 10v2"/>
                      <path d="M18 10v2"/>
                    </svg>
                  </div>
                  <div className="text-lg font-semibold">{listing.bathrooms}</div>
                </div>
              )}
              {Number(listing.bedrooms) > 0 && (
                <div className="rounded-lg bg-white shadow-sm px-3 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-700"><span>Bedroom</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-sky-700">
                      <path d="M3 7v11"/>
                      <rect x="7" y="11" width="14" height="7" rx="2"/>
                      <path d="M7 11V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2"/>
                    </svg>
                  </div>
                  <div className="text-lg font-semibold">{listing.bedrooms}</div>
                </div>
              )}
              {Number(listing.floorArea) > 0 && (
                <div className="rounded-lg bg-white shadow-sm px-3 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-700"><span>Floor Area</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-sky-700"><path d="M3 3h18v18H3z"/><path d="M9 9l6 6M15 9l-6 6"/></svg></div>
                  <div className="flex items-baseline gap-2"><div className="text-lg font-semibold">{listing.floorArea}</div><div className="text-xs text-slate-500">SQ.M.</div></div>
                </div>
              )}
              {Number(listing.lotArea) > 0 && (
                <div className="rounded-lg bg-white shadow-sm px-3 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-700"><span>Lot Area</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-sky-700"><path d="M3 3h18v18H3z"/></svg></div>
                  <div className="flex items-baseline gap-2"><div className="text-lg font-semibold">{listing.lotArea}</div><div className="text-xs text-slate-500">SQ.M.</div></div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="bg-[#223B55] text-white text-center font-semibold px-3 py-2">About {listing.title}</div>
              <p className="text-sm mt-2">{listing.description}</p>
            </div>
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-1">Property Type</div>
              <div className="text-sm">{typeText}</div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold text-black mb-2">Property Features</div>
              {indoor.length ? (
                <>
                  <div className="text-xs text-slate-500 mb-1">Indoor Features</div>
                  <div className="space-y-1">
                    {indoor.map((f: string, i: number) => (
                      <span key={`in-${i}`} className="block text-sm text-[#DE6A4A]"><span className="inline-block w-2 h-2 bg-[#DE6A4A] mr-2 align-middle"></span><span>{f}</span></span>
                    ))}
                  </div>
                </>
              ) : null}
              {outdoor.length ? (
                <>
                  <div className="text-xs text-slate-500 mt-3 mb-1">Outdoor Features</div>
                  <div className="space-y-1">
                    {outdoor.map((f: string, i: number) => (
                      <span key={`out-${i}`} className="block text-sm text-[#DE6A4A]"><span className="inline-block w-2 h-2 bg-[#DE6A4A] mr-2 align-middle"></span><span>{f}</span></span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="mt-6">
              <div className="text-sm font-bold text-[#223B55] uppercase tracking-wide border-b-2 border-[#223B55] pb-1">Property Summary</div>
              <div className="mt-3 space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-6">
                  <div className="text-sm text-slate-700 w-full sm:w-24">Price:</div>
                  <div className="text-sm font-bold">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(priceCalc)}</div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-6">
                  <div className="text-sm text-slate-700 w-full sm:w-24">Location:</div>
                  <div className="text-sm font-bold">{locationText || "N/A"}</div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-6">
                  <div className="text-sm text-slate-700 w-full sm:w-24">Floor Area:</div>
                  <div className="text-sm font-bold">{floorAreaText}</div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-sm font-bold text-[#223B55] uppercase tracking-wide border-b-2 border-[#223B55] pb-1">Property on Map</div>
              <div className="mt-3 rounded overflow-hidden border">
                <iframe title="Property Map" src={mapUrl} className="w-full h-64" loading="lazy" />
              </div>
            </div>
            <div className="mt-6">
              <div className="text-sm font-bold text-[#223B55] uppercase tracking-wide mb-3">Interested on this property?</div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Link href="/contact?subject=Interested" className="flex-1 sm:flex-none inline-flex items-center justify-center rounded border border-[#DE6A4A] text-[#DE6A4A] px-3 py-1 text-sm whitespace-nowrap">Interested</Link>
                <Link href="/contact?subject=Question" className="flex-1 sm:flex-none inline-flex items-center justify-center rounded border border-[#DE6A4A] text-[#DE6A4A] px-3 py-1 text-sm whitespace-nowrap">Question</Link>
                <Link href="/contact?subject=Visit" className="flex-1 sm:flex-none inline-flex items-center justify-center rounded border border-[#DE6A4A] text-[#DE6A4A] px-3 py-1 text-sm whitespace-nowrap">Visit</Link>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-sm font-bold text-[#223B55] uppercase tracking-wide border-b-2 border-[#223B55] pb-1">Affordability Checker</div>
              <div className="mt-3">
                <div className="text-sm text-slate-700">Property Price: <span className="font-bold">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(priceCalc)}</span></div>
                <div className="text-sm text-slate-700 mt-1">Suggested Gross Household Income/Salary</div>
                <div className="text-xl font-bold">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(grossMonthlySuggested)}</div>
                <div className="text-sm text-slate-700">{termYears} years to pay at {ratePercent}% interest</div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded border border-[#DE6A4A] px-3 py-2">
                  <div className="text-sm text-slate-700">Monthly Payment</div>
                  <div className="text-lg font-bold">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(monthlyPayment)}</div>
                </div>
                <div className="rounded border border-[#DE6A4A] px-3 py-2">
                  <div className="text-sm text-slate-700">{Math.round(dpPercent)}% Down Payment</div>
                  <div className="text-lg font-bold">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(dpAmount)}</div>
                </div>
                <div className="rounded border border-[#DE6A4A] px-3 py-2">
                  <div className="text-sm font-bold">{ratePercent}% Interest Rate</div>
                </div>
                <div className="rounded border border-[#DE6A4A] px-3 py-2">
                  <div className="text-sm text-slate-700">Loanable Amount</div>
                  <div className="text-lg font-bold">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(loanable)}</div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-sm font-bold text-[#223B55] uppercase tracking-wide border-b-2 border-[#223B55] pb-1">Property Calculator</div>
              <PropertyCalculator 
                id={listing.id} 
                initialPrice={priceCalc} 
                initialDp={dpStr} 
                initialRate={ratePercent} 
                initialTerm={termYears} 
              />
            </div>
            <div className="mt-4"><Link href="/" className="btn-outline">Back to Listings</Link></div>
            <div className="mt-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <div className="text-xl sm:text-2xl font-semibold">Similar Properties</div>
                <div className="text-xs text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded">Total: {totalSimilar}</div>
              </div>
              <SimilarCarousel items={similar} />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <ContactAgentCard listingId={listing.id} listingTitle={listing.title} agent={agent} />
          <QuickLinksSelector />
        </div>
      </div>
      <MainFooterCards />
    </div>
  );
}
