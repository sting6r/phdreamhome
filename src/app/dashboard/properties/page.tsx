"use client";
import useSWR from "swr";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

import { supabase } from "@lib/supabase";
const fetcher = async (u: string, { signal }: { signal?: AbortSignal } = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 30000);

  let combinedSignal: AbortSignal = controller.signal;
  const anyFn = (AbortSignal as any).any;
  if (signal && typeof anyFn === "function") {
    combinedSignal = anyFn([signal, controller.signal]);
  } else if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const isAbortError = (e: any) => {
    const name = String(e?.name || "").toLowerCase();
    const msg = String(e?.message || "").toLowerCase();
    return name.includes("abort") || msg.includes("abort") || combinedSignal.aborted || e?.code === 20;
  };

  try {
    const r = await fetch(u, { 
      headers,
      signal: combinedSignal
    });
    
    const text = await r.text();
    let resData;
    try {
      resData = JSON.parse(text);
    } catch (e: any) {
      if (isAbortError(e)) return null;
      console.warn(`Properties fetcher parse warning:`, u, r.status);
      resData = { error: "Invalid server response" };
    }

    if (!r.ok) throw new Error(resData.error || `Fetch failed: ${r.status}`);
    return resData;
  } catch (err: any) {
    if (isAbortError(err)) {
      return null;
    }
    const msg = String(err?.message || "").toLowerCase();
    if (err instanceof TypeError && (msg.includes("failed to fetch") || msg.includes("network"))) return null;
    console.warn("Properties fetcher warning:", err?.message || err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function PropertiesPage() {
  const swrCfg = { onError: (err: any) => { const msg = String(err?.message || ""); if (err?.name === "AbortError" || /abort/.test(msg)) return; } };
  const { data, mutate } = useSWR("/api/listings", fetcher, swrCfg);
  const listings = data?.listings ?? [];
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  async function setStatus(id: string, status: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      await fetch(`/api/listings/${id}`, { 
        method: "PUT", 
        headers, 
        body: JSON.stringify({ status }),
        signal: controller.signal
      });
    } catch (e: any) {
      if (e.name === "AbortError") console.warn("setStatus timeout");
      else console.error("setStatus error", e);
    } finally {
      clearTimeout(timeoutId);
    }
    setOpenId(null);
    mutate();
  }

  async function setFeatured(id: string, featured: boolean) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      await fetch(`/api/listings/${id}`, { 
        method: "PUT", 
        headers, 
        body: JSON.stringify({ featured }),
        signal: controller.signal
      });
    } catch (e: any) {
      if (e.name === "AbortError") console.warn("setFeatured timeout");
      else console.error("setFeatured error", e);
    } finally {
      clearTimeout(timeoutId);
    }
    mutate();
  }

  async function setFeaturedPreselling(id: string, featuredPreselling: boolean) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      await fetch(`/api/listings/${id}`, { 
        method: "PUT", 
        headers, 
        body: JSON.stringify({ featuredPreselling }),
        signal: controller.signal
      });
    } catch (e: any) {
      if (e.name === "AbortError") console.warn("setFeaturedPreselling timeout");
      else console.error("setFeaturedPreselling error", e);
    } finally {
      clearTimeout(timeoutId);
    }
    mutate();
  }

  async function setPublished(id: string, published: boolean) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      await fetch(`/api/listings/${id}`, { 
        method: "PUT", 
        headers, 
        body: JSON.stringify({ published }),
        signal: controller.signal
      });
    } catch (e: any) {
      if (e.name === "AbortError") console.warn("setPublished timeout");
      else console.error("setPublished error", e);
    } finally {
      clearTimeout(timeoutId);
    }
    setOpenId(null);
    mutate();
  }

  async function remove(id: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      await fetch(`/api/listings/${id}`, { 
        method: "DELETE",
        signal: controller.signal
      });
    } catch (e: any) {
      if (e.name === "AbortError") console.warn("remove timeout");
      else console.error("remove error", e);
    } finally {
      clearTimeout(timeoutId);
    }
    mutate();
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (openId && menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenId(null);
    }
    document.addEventListener("mousedown", handle);
    return () => { document.removeEventListener("mousedown", handle); };
  }, [openId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">My Properties</h1>
        <Link href="/dashboard/listings/new" className="btn-blue" prefetch={false}>Add Property</Link>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-black bg-slate-50 border-b">
              <tr>
                <th className="text-left py-3 px-4">Featured</th>
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Actions</th>
                <th className="text-left py-3 px-4">Property Type</th>
                <th className="text-left py-3 px-4">Published</th>
                <th className="text-left py-3 px-4">SEO</th>
                <th className="text-left py-3 px-4">Price</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l: any) => (
                <tr key={l.id} className="border-t hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 align-top">
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                        <input type="checkbox" className="rounded" checked={!!l.featured} onChange={e => setFeatured(l.id, e.target.checked)} />
                        <span>Featured</span>
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                        <input type="checkbox" className="rounded" checked={!!l.featuredPreselling} onChange={e => setFeaturedPreselling(l.id, e.target.checked)} />
                        <span>Preselling</span>
                      </label>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium">
                    <Link 
                      href={`/listing/${l.slug || l.id}`} 
                      target="_blank" 
                      className="hover:underline text-blue-600 hover:bg-purple-50 hover:shadow-sm transition-all rounded px-1 -mx-1"
                      prefetch={false}
                    >
                      {l.title}
                    </Link>
                  </td>
                  <td className="py-3 px-4"><span className="inline-block rounded px-2 py-1 text-xs bg-slate-100 text-slate-600 whitespace-nowrap">{l.status}</span></td>
                  <td className="py-3 px-4">
                    <div className="relative inline-block">
                      <button aria-label="Actions" className="rounded-md px-2 py-1 hover:bg-slate-100" onClick={() => setOpenId(openId === l.id ? null : l.id)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-black">
                          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                      {openId === l.id && (
                        <div ref={menuRef} className="absolute left-0 mt-2 w-40 rounded-md bg-white shadow border border-slate-200 z-30 actions-menu">
                          <div className="px-3 py-2 text-xs text-slate-500">Actions</div>
                          <Link href={`/dashboard/listings/${l.id}/edit`} className="block px-3 py-1 text-sm" prefetch={false}>Edit</Link>
                          <button className="block w-full text-left px-3 py-1 text-sm" onClick={() => setPublished(l.id, true)}>Publish</button>
                          <button className="block w-full text-left px-3 py-1 text-sm" onClick={() => setPublished(l.id, false)}>Unpublish</button>
                          <button className="block w-full text-left px-3 py-1 text-sm" onClick={() => setStatus(l.id, "For Rent")}>Set For Rent</button>
                          <button className="block w-full text-left px-3 py-1 text-sm" onClick={() => setStatus(l.id, "Occupied")}>Set Occupied</button>
                          <button className="block w-full text-left px-3 py-1 text-sm" onClick={() => setStatus(l.id, "For Sale")}>Set For Sale</button>
                          <button className="block w-full text-left px-3 py-1 text-sm" onClick={() => setStatus(l.id, "Sold")}>Set Sold</button>
                          <button className="block w-full text-left px-3 py-1 text-sm text-red-600" onClick={() => { remove(l.id); setOpenId(null); }}>Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{l.type}</td>
                  <td className="py-3 px-4 text-center">{l.published ? "Yes" : "No"}</td>
                   <td className="py-3 px-4">
                    {(() => {
                      const tl = String(l.seoTitle || "").trim().length;
                      const dl = String(l.seoDescription || "").trim().length;
                      const hasKw = Array.isArray(l.seoKeywords) ? l.seoKeywords.length > 0 : false;
                      const hasImg = Array.isArray(l.images) ? l.images.length > 0 : false;
                      const score =
                        (tl >= 50 && tl <= 60 ? 30 : 0) +
                        (dl >= 140 && dl <= 160 ? 30 : 0) +
                        (hasKw ? 20 : 0) +
                        (l.published ? 10 : 0) +
                        (hasImg ? 10 : 0);
                      const cls = score >= 80 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-700";
                      return <span className={`inline-block rounded px-2 py-1 text-xs ${cls}`}>{score}%</span>;
                    })()}
                   </td>
                   <td className="py-3 px-4 font-medium whitespace-nowrap">{mounted ? `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
