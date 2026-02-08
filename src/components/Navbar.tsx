"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { createClientSideClient } from "@lib/supabase";

export default function Navbar() {
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const syncLockRef = useRef<string | null>(null);
  const avatarCacheRef = useRef<string | null>(null);
  const supabase = useMemo(() => createClientSideClient(), []);
  
  async function safePost(url: string, body: any) {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).sendBeacon) {
        const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        (navigator as any).sendBeacon(url, blob);
        return;
      }
      await fetch(url, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(body), 
        keepalive: true 
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      if (e instanceof TypeError && e.message === "Failed to fetch") return;
    }
  }
  function shouldSync(userId: string) {
    try {
      if (!userId) return false;
      if (syncLockRef.current === userId) return false;
      const k = `sync-user:${userId}`;
      const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(k) : null;
      const last = raw ? Number(raw) : 0;
      const now = Date.now();
      if (last && now - last < 300000) return false;
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(k, String(now));
      syncLockRef.current = userId;
      return true;
    } catch {
      return true;
    }
  }
  async function loadProfileAvatar(signal?: AbortSignal) {
    try {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      
      const ck = "profile-image-url";
      const ek = "profile-image-url-exp";
      const now = Date.now();
      const expRaw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ek) : null;
      const exp = expRaw ? Number(expRaw) : 0;
      const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ck) : null;
      if (cached && cached !== "null" && exp && now < exp) {
        console.log("Navbar: Using cached avatar:", cached);
        avatarCacheRef.current = cached;
        setAvatar(v => v || cached);
        return;
      }
      const r = await fetch("/api/profile", { signal });
      if (!r.ok) {
        console.warn(`Profile fetch failed: ${r.status}`);
        return;
      }
      const j = await r.json();
      const url = j.imageUrl as string | null;
      console.log("Navbar: /api/profile returned imageUrl:", url);
      if (url && url !== "null") {
        avatarCacheRef.current = url;
        setAvatar(url);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(ck, url);
          sessionStorage.setItem(ek, String(now + 300000));
        }
      } else {
        console.log("Navbar: No imageUrl in profile, keeping current avatar state.");
        // We do NOT clear the avatar state here because we might still have a Google fallback
        // from the session data. Only clear the cache if it's explicitly null in the DB.
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem(ck);
          sessionStorage.removeItem(ek);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (err.message === 'Failed to fetch') return; // Silently handle network aborts
      console.error("Navbar: Profile fetch error:", err);
    }
  }
  useEffect(() => {
    setIsClient(true);
    setMounted(true);
    const controller = new AbortController();
    
    // Use the same client for everything
    const auth = supabase.auth;

    auth.getSession().then(({ data }: { data: { session: any } }) => {
      if (controller.signal.aborted) return;
      const session = data.session;
      setLoggedIn(!!session);
      if (session) {
        const token = session.access_token;
        if (token) {
          safePost("/api/auth/session", { access_token: token });
        }
        const u = session.user;
        if (u) {
          setName((u as any)?.user_metadata?.name || null);
          setEmail(u.email || null);
          const mAvatar = null; // Do not use u?.user_metadata?.avatar_url or u?.user_metadata?.picture
          console.log("Navbar: Session user avatar:", mAvatar);
          // If we have a cached avatar from the API, prefer that over the session avatar
          if (avatarCacheRef.current) {
            setAvatar(avatarCacheRef.current);
          } else {
            setAvatar(null);
          }
          
          if (u.id && u.email && shouldSync(u.id)) {
            console.log("Navbar: Syncing user from session load.");
            safePost("/api/auth/sync-user", { 
              userId: u.id, 
              email: u.email, 
              name: (u as any)?.user_metadata?.name, 
              username: (u as any)?.user_metadata?.user_name, 
              phone: (u as any)?.phone || (u as any)?.user_metadata?.phone 
            });
          }
        }
      }
      
      loadProfileAvatar(controller.signal);
    });

    const { data: sub } = auth.onAuthStateChange((_e: any, session: any) => {
      console.log("Navbar: Auth state change:", _e);
      setLoggedIn(!!session);
      if (session) {
        const token = session.access_token;
        if (token) {
          safePost("/api/auth/session", { access_token: token });
        }
        const u = session.user as any;
        if (u) {
          setName(u?.user_metadata?.name || null);
          setEmail(u?.email || null);
          const mAvatar = null; // Do not use u?.user_metadata?.avatar_url or u?.user_metadata?.picture
          console.log("Navbar: Auth state change avatar:", mAvatar);
          // If we have a cached avatar from the API, prefer that over the session avatar
          if (avatarCacheRef.current) {
            setAvatar(avatarCacheRef.current);
          } else {
            setAvatar(null);
          }
          
          if (u.id && u.email && shouldSync(u.id)) {
            console.log("Navbar: Syncing user from auth state change.");
            safePost("/api/auth/sync-user", { 
              userId: u.id, 
              email: u.email, 
              name: u?.user_metadata?.name, 
              username: u?.user_metadata?.user_name, 
              phone: u?.phone || u?.user_metadata?.phone 
            });
          }
        }
        if (!controller.signal.aborted) {
          loadProfileAvatar(controller.signal);
        }
      } else {
        // Clear state on logout
        setName(null);
        setEmail(null);
        setAvatar(null);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("profile-image-url");
          sessionStorage.removeItem("profile-image-url-exp");
        }
      }
    });

    return () => { 
      controller.abort();
      sub.subscription.unsubscribe(); 
    };
  }, [supabase.auth, pathname]); // Added supabase.auth and pathname to deps to satisfy ESLint and ensure correct re-runs

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handle);
    }
    return () => { 
      document.removeEventListener("mousedown", handle); 
    };
  }, [open]);
  const initials = (name || email || "").trim().slice(0, 1).toUpperCase() || "?";
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 0); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true } as any);
    return () => { window.removeEventListener("scroll", onScroll); };
  }, []);
  return (
    <div className={`sticky top-0 z-50 w-full ${isClient && scrolled ? "bg-[#E5AFFF]" : "bg-[#F4DDFF]"}`}>
      <div className="container flex items-center justify-between h-[3.75rem]">
        <Link href="/" prefetch={false} className="flex items-center">
          <Image src="/logo.svg" alt="PhDreamHome" width={140} height={70} className="rounded mr-3 shrink-0 mt-1 sm:mt-2 sm:w-[200px]" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-5 h-full">
          <nav className="hidden sm:flex items-center gap-2 sm:gap-5 self-end mb-1 overflow-x-auto whitespace-nowrap pr-2 no-scrollbar">
            <Link href="/contact" prefetch={false} className="inline-flex items-center gap-1 sm:gap-2 btn-blue btn-glow-soft px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm">
              <span className="underline-run hidden xs:inline">Sell your Property Today?</span>
              <span className="underline-run xs:hidden">Sell Property</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M21 15a2 2 0 0 1-2 2h-3l-4 4v-4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9z"/></svg>
            </Link>
          </nav>
          <div className="flex items-center gap-3 relative">
            {mounted && loggedIn && (
              <>
                <button aria-label="User menu" className="relative w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center" onClick={()=>setOpen(v=>!v)}>
                  {avatar ? (
                    <Image 
                      src={avatar} 
                      alt="avatar" 
                      fill 
                      sizes="36px" 
                      className="object-cover"
                      unoptimized
                      onError={() => {
                        console.error("Navbar: Avatar image failed to load:", avatar);
                        setAvatar(null); // Fallback to initials if image fails
                      }}
                    />
                  ) : (
                    <span className="text-sm font-medium text-black">{initials}</span>
                  )}
                </button>
                {open && (
                  <div ref={menuRef} className="absolute right-0 top-12 w-56 rounded-md border border-gray-200 bg-white shadow z-50">
                    <div className="px-3 py-2">
                      <div className="text-sm font-semibold">{name || "User"}</div>
                      {email && <div className="text-xs text-black">{email}</div>}
                    </div>
                    <div className="border-t">
                      <Link prefetch={false} href="/dashboard" onClick={()=>setOpen(false)} className="block mx-2 my-1 px-3 py-2 text-sm rounded-md hover:bg-teal-200 hover:text-black">Dashboard</Link>
                      <Link prefetch={false} href="/dashboard/profile" onClick={()=>setOpen(false)} className="block mx-2 my-1 px-3 py-2 text-sm rounded-md hover:bg-teal-200 hover:text-black">Profile</Link>
                      <Link prefetch={false} href="/dashboard/properties" onClick={()=>setOpen(false)} className="block mx-2 my-1 px-3 py-2 text-sm rounded-md hover:bg-teal-200 hover:text-black">My Properties</Link>
                      <Link prefetch={false} href="/dashboard/listings/new" onClick={()=>setOpen(false)} className="block mx-2 my-1 px-3 py-2 text-sm rounded-md hover:bg-teal-200 hover:text-black">Add Property</Link>
                      <button 
                        className="block w-[calc(100%-1rem)] mx-2 my-1 text-left px-3 py-2 text-sm rounded-md hover:bg-teal-200 hover:text-black" 
                        onClick={async () => { 
                          setOpen(false); 
                          setLoggedIn(false);
                          setAvatar(null);
                          await supabase.auth.signOut();
                          window.location.href = "/";
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {!loggedIn && mounted && (
              null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
