"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function StatusLinksCard() {
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    setIsClient(true);
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenStatus(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpenStatus(null); }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocMouseDown); document.removeEventListener("keydown", onKey); };
  }, []);
  useEffect(() => { setOpenStatus(null); setMobileMenuOpen(false); }, [pathname, params]);
  useEffect(() => { setOpenSub(null); }, [openStatus]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); };
  }, []);
  function statusItem(label: string, slug: string, children?: React.ReactNode) {
    return (
      <div
        className="relative group"
      >
        <button
          type="button"
          className="text-base font-semibold leading-tight text-[#32004A] hover:text-blue-600"
          aria-haspopup="menu"
          aria-expanded={openStatus === slug}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpenStatus(prev => prev === slug ? null : slug);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setOpenStatus(prev => prev === slug ? null : slug);
            }
          }}
        >
          {label}
        </button>
        <div
          role="menu"
          className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 min-w-44 w-fit card shadow-xl ring-1 ring-black/10 p-1 z-50 ${openStatus === slug ? "block" : "hidden"}`}
        >
          {children || (
            <>
              <Link prefetch={false} role="menuitem" href={`/properties/${slug}`} className="block px-3 py-1.5 text-sm font-bold leading-normal text-blue-700 hover:bg-blue-50 border-b border-slate-100 mb-1">All {label}</Link>
              <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Condominium")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Condominium</Link>
              <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Town House")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Town House</Link>
              <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("House and Lot")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">House and Lot</Link>
              {slug !== "rfo" && slug !== "preselling" ? (
                <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Beach Property")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Beach Property</Link>
              ) : null}
              {slug !== "rfo" ? (
                <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Lot Only")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Lot Only</Link>
              ) : null}
              {slug !== "rfo" && slug !== "preselling" ? (
                <div className="relative">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100 flex items-center justify-between"
                    aria-haspopup="menu"
                    aria-expanded={openSub === `commercial-${slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenSub(prev => prev === `commercial-${slug}` ? null : `commercial-${slug}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenSub(prev => prev === `commercial-${slug}` ? null : `commercial-${slug}`);
                      }
                    }}
                  >
                    <span>Commercial Space</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 transition-transform ${openSub === `commercial-${slug}` ? "rotate-90" : ""}`}><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                  <div
                    role="menu"
                    className={`absolute top-0 left-full ml-1 min-w-44 w-fit card shadow-xl ring-1 ring-black/10 p-0.5 z-50 ${openSub === `commercial-${slug}` ? "block" : "hidden"}`}
                  >
                    <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Commercial Space")}`} className="block px-3 py-1.5 text-xs font-bold text-blue-700 border-b border-slate-100 mb-1">All Commercial</Link>

                    <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Commercial Space")}&commercialSubtype=${encodeURIComponent("Commercial Lot")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Commercial Lot</Link>
                    <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Commercial Space")}&commercialSubtype=${encodeURIComponent("Shop")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Shop</Link>
                    <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Commercial Space")}&commercialSubtype=${encodeURIComponent("Store")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Store</Link>
                  </div>
                </div>
              ) : null}
              {slug !== "rfo" && slug !== "preselling" ? (
                <div className="relative">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100 flex items-center justify-between"
                    aria-haspopup="menu"
                    aria-expanded={openSub === `industrial-${slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenSub(prev => prev === `industrial-${slug}` ? null : `industrial-${slug}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenSub(prev => prev === `industrial-${slug}` ? null : `industrial-${slug}`);
                      }
                    }}
                  >
                    <span>Industrial Properties</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 transition-transform ${openSub === `industrial-${slug}` ? "rotate-90" : ""}`}><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                  <div
                    role="menu"
                    className={`absolute top-0 left-full ml-1 min-w-44 w-fit card shadow-xl ring-1 ring-black/10 p-0.5 z-50 ${openSub === `industrial-${slug}` ? "block" : "hidden"}`}
                  >
                    <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Industrial Properties")}`} className="block px-3 py-1.5 text-xs font-bold text-blue-700 border-b border-slate-100 mb-1">All Industrial</Link>
                    <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Industrial Properties")}&industrySubtype=${encodeURIComponent("Office Space")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Office Space</Link>
                    <Link prefetch={false} role="menuitem" href={`/properties/${slug}?type=${encodeURIComponent("Industrial Properties")}&industrySubtype=${encodeURIComponent("Warehouse")}`} className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Warehouse</Link>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }
  function blogItem() {
    const slug = "blog-menu";
    const categories = ["Featured Projects", "Real Estate Insights", "Tips and Guides", "Travel Visit"];
    const content = (
      <>
        <Link prefetch={false} role="menuitem" href="/blog" className="block px-3 py-1.5 text-sm font-bold leading-normal text-blue-700 hover:bg-blue-50 border-b border-slate-100 mb-1">All Blogs</Link>
        {categories.map(cat => (
          <Link 
            key={cat}
            prefetch={false} 
            role="menuitem" 
            href={`/blog?category=${encodeURIComponent(cat)}`} 
            className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100"
          >
            {cat}
          </Link>
        ))}
      </>
    );
    return statusItem("Blog", slug, content);
  }
  function aboutItem() {
    const slug = "about-menu";
    const content = (
      <>
        <Link prefetch={false} role="menuitem" href="/about" className="block px-3 py-1.5 text-sm font-bold leading-normal text-blue-700 hover:bg-blue-50 border-b border-slate-100 mb-1">About PHDreamHome</Link>
        <Link prefetch={false} role="menuitem" href="/about/team" className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Team</Link>
        <Link prefetch={false} role="menuitem" href="/about/mission" className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Mission</Link>
        <Link prefetch={false} role="menuitem" href="/about/careers" className="block px-3 py-1 text-sm leading-normal text-[#32004A] hover:bg-slate-100">Careers</Link>
      </>
    );
    return statusItem("About", slug, content);
  }
  return (
    <div
      ref={containerRef}
      className={`relative border-b border-gray-200 ${isClient && scrolled ? "bg-[#F4DDFF]" : "bg-white"} w-full z-[100]`}
    >
      <div className="sm:hidden w-full bg-[#E5AFFF] border-b border-black/5 py-1.5 px-4 flex justify-between items-center">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md hover:bg-black/5 transition-colors focus:outline-none"
          aria-label="Toggle Menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-[#32004A]">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        <Link href="/contact" prefetch={false} className="inline-flex items-center gap-1.5 btn-blue btn-glow-soft px-3 py-1.5 text-xs">
          <span className="underline-run">Sell Property</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M21 15a2 2 0 0 1-2 2h-3l-4 4v-4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9z"/></svg>
        </Link>
      </div>
      <div className={`${mobileMenuOpen ? "flex" : "hidden"} sm:flex px-3 py-1.5 mx-auto flex-col sm:flex-row flex-wrap items-center justify-center sm:justify-center gap-x-6 gap-y-3 sm:gap-y-1.5 sm:gap-[2ch] text-center overflow-x-visible pb-4 sm:pb-1.5`}>
        <Link prefetch={false} href="/" className="text-base font-semibold leading-tight text-[#32004A] hover:text-blue-600">
          Home
        </Link>
        {statusItem("For Sale", "for-sale")}
        {statusItem("For Rent", "for-rent")}
        {statusItem("Preselling", "preselling")}
        {statusItem("RFO", "rfo")}
        {blogItem()}
        {aboutItem()}
        <Link prefetch={false} href="/contact" className="text-base font-semibold leading-tight text-[#32004A] hover:text-blue-600">
          Contact
        </Link>
      </div>
    </div>
  );
}
