"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 13h8V3H3v10zm10 8h8V3h-8v18z"/></svg> },
  { href: "/dashboard/properties", label: "Properties", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 21h18V8l-9-6-9 6v13z"/></svg> },
  { href: "/dashboard/inquiries", label: "Mail Inquiries", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg> },
  { href: "/dashboard/ai-inquiries", label: "AI Inquiries", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2l1.45 4.45L18 8l-4.55 1.55L12 14l-1.45-4.45L6 8l4.55-1.55L12 2zM12 17l.72 2.22L15 20l-2.28.78L12 23l-.72-2.22L9 20l2.28-.78L12 17zM5 13l.48 1.48L7 15l-1.52.52L5 17l-.48-1.48L3 15l1.52-.52L5 13z"/></svg> },
  { href: "/dashboard/sales", label: "Sales Records", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.82v-1.91c-1.84-.23-3.15-1.28-3.23-2.92h1.96c.07.76.69 1.3 1.63 1.3 1.05 0 1.6-.53 1.6-1.18 0-.64-.46-1.07-1.85-1.42-2.12-.53-3.41-1.35-3.41-3.15 0-1.63 1.25-2.73 2.92-2.96V6h2.82v1.92c1.47.19 2.66 1.09 2.79 2.61h-1.96c-.11-.73-.66-1.18-1.58-1.18-.84 0-1.45.39-1.45 1.05 0 .6.49.95 1.93 1.31 2.22.56 3.33 1.45 3.33 3.14 0 1.83-1.4 2.87-3.16 3.19z"/></svg> },
  { href: "/dashboard/rentals", label: "Rental Records", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg> },
  { href: "/dashboard/blog", label: "Blog Editor", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 4h16v16H4z"/><path d="M8 8h8v2H8zM8 12h8v2H8zM8 16h5v2H8z"/></svg> },
  { href: "/dashboard/profile", label: "Profile", icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm-9 9a9 9 0 1118 0H3z"/></svg> },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [asideTop, setAsideTop] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function update() {
      const wrapper = document.getElementById("status-links-wrapper");
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      setAsideTop(rect.top + rect.height);
    }
    update();
    window.addEventListener("scroll", update, { passive: true } as any);
    window.addEventListener("resize", update, { passive: true } as any);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 sm:col-span-3 lg:col-span-2 bg-slate-100 shadow-sm">
          <div className="sticky" style={mounted ? { top: asideTop } : undefined}>
            <nav className="space-y-2 rounded-lg bg-slate-100 p-3">
              {mounted && NAV_ITEMS.map((navItem) => {
                const active = pathname === navItem.href;
                return (
                  <Link
                    key={navItem.href}
                    href={active ? "#" : navItem.href}
                    prefetch={false}
                    onClick={(e) => {
                      if (active) {
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                      active ? "bg-sky-50 text-sky-600 cursor-default" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {navItem.icon}
                    <span>{navItem.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <section className="col-span-12 sm:col-span-9 lg:col-span-10">
          {children}
        </section>
      </div>
    </>
  );
}
