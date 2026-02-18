"use client";
import { useEffect, useState, useRef, use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@lib/supabase";
import { getProxyImageUrl } from "@lib/image-utils";
import CurrencyInput from "@components/CurrencyInput";

import { Suspense } from "react";

function EditListingPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [images, setImages] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageIds, setImageIds] = useState<(string|null)[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const confirmOkRef = useRef<(() => Promise<void> | void) | null>(null);
  function openConfirm(message: string, onOk: () => Promise<void> | void) {
    setConfirmMessage(message);
    confirmOkRef.current = onOk;
    setConfirmOpen(true);
  }
  async function runConfirmOk() {
    if (!confirmOkRef.current) { setConfirmOpen(false); return; }
    setConfirmLoading(true);
    try { await Promise.resolve(confirmOkRef.current()); } finally { setConfirmLoading(false); setConfirmOpen(false); }
  }
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState<number | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeyword, setSeoKeyword] = useState("");
  const INDOOR_OPTIONS = [
    "Alarm System","Balcony","Basement","Drivers Room","Ensuite","Bar","Terrace","Maids Room","Library","Air-Conditioning","Attic","CCTV","Broadband Internet","Cable","Built-in Wardrobes","Central Air","Ducted Cooling","Entertainment Room","Fire Alarm","Fireplace","Floorboards","Gym","Jacuzzi","Lounge","Pay TV Access","Powder Room","Sauna","Smoke Detector","Hot Shower","WIFI","Pets Allowed","Storage Room","Study Room"
  ];
  const OUTDOOR_OPTIONS = [
    "Badminton Court","Carport","Courtyard","Fully Fenced","Garage","Helipad","Jogging Path","Open Car Spaces","Secure Parking","Parks","Shower Rooms","Sport Facility","Swimming Pool","Club House","Tennis Court","Function Area","24-Hour Security","Balcony","Playground","Basketball Court","Garden","Gazebo","Jacuzzi","Landscape Garden","Multi Purpose Lawn","Parking Lot","Remote Garden","Volley Ball Court","Open Space","Commercial Stores"
  ];
  const [form, setForm] = useState({
    title: "", description: "", price: 0, address: "", city: "", state: "", country: "",
    bedrooms: 0, bathrooms: 0, floorArea: 0, lotArea: 0, parking: 0, owner: "", developer: "", status: "For Rent", type: "Condominium", published: true, industrySubtype: "", commercialSubtype: "",
    indoorFeatures: [] as string[], outdoorFeatures: [] as string[], landmarks: [] as string[]
  });
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string,string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const r = await fetch(`/api/listings/${id}`, { 
          headers,
          signal: controller.signal 
        });
        
        const text = await r.text();
        let d;
        try {
          d = JSON.parse(text);
        } catch (e) {
          console.error("Listing fetch parse error. Status:", r.status, "Body:", text.slice(0, 200));
          return;
        }

        const found = d.listing;
        if (found) {
          setForm({
            title: found.title, description: found.description, price: found.price, address: found.address,
            city: found.city, state: found.state, country: found.country, bedrooms: found.bedrooms,
            bathrooms: found.bathrooms, floorArea: found.floorArea ?? 0, lotArea: found.lotArea ?? 0, parking: found.parking ?? 0, owner: found.owner || "", developer: found.developer || "",
            status: found.status, type: found.type, published: found.published, industrySubtype: found.industrySubtype || "", commercialSubtype: found.commercialSubtype || "",
            indoorFeatures: found.indoorFeatures || [], outdoorFeatures: found.outdoorFeatures || [], landmarks: found.landmarks || []
          });
          setSeoTitle(found.seoTitle || "");
          setSeoDescription(found.seoDescription || "");
          setSeoKeyword(Array.isArray(found.seoKeywords) ? found.seoKeywords.join(", ") : "");
          setImages(found.images.map((i:any)=>i.path ?? i.url));
          setPreviews(found.images.map((i:any)=>i.url));
          setImageIds(found.images.map((i:any)=>i.id ?? null));
          if ((found.images || []).length > 0) setFeaturedIndex(0);
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
        console.error("Fetch listing error:", err);
      } finally {
        clearTimeout(timeoutId);
      }
    })();
  }, [id]);

  useEffect(() => {
    const adjustHeight = (el: HTMLTextAreaElement) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    const textareas = document.querySelectorAll("textarea");
    textareas.forEach(el => adjustHeight(el as HTMLTextAreaElement));
  }, [form.description, seoDescription]);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("files", f));
    setUploading(true);
    setUploadProgress(0);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.timeout = 30000; // 30 second timeout
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setUploadProgress(pct);
        }
      };
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText);
              setImages(prev => [...prev, ...(data.paths as string[])]);
              setPreviews(prev => [...prev, ...(data.signedUrls as string[])]);
              setImageIds(prev => [...prev, ...(data.paths as string[]).map(()=>null)]);
              resolve();
            } else {
              reject(new Error("Upload failed"));
            }
          } catch (err) {
            reject(err as any);
          }
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(fd);
    }).catch(() => {});
    setUploading(false);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveMessage(null);
    let ordered = [...images];
    if (featuredIndex !== null && featuredIndex >= 0 && featuredIndex < ordered.length) {
      const [f] = ordered.splice(featuredIndex, 1);
      ordered = [f, ...ordered];
    }
    const payload = { ...form, images: ordered, seoTitle, seoDescription, seoKeyword };
    setSaving(true);
    setSaveProgress(10);
    const timer = setInterval(() => setSaveProgress(p => Math.min(95, p + 5)), 200);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`/api/listings/${id}`, { 
        method: "PUT", 
        headers, 
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearInterval(timer);
      const text = await res.text();
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        console.error("Listing update parse error. Status:", res.status, "Body:", text.slice(0, 200));
        errorData = { error: "Invalid server response" };
      }

      if (res && res.ok) {
        setSaveProgress(100);
        setSaveMessage("Saved");
        setTimeout(() => { window.location.href = "/dashboard/properties"; }, 750);
      } else {
        setError(errorData.error || errorData.details || "Failed to save changes");
        setSaving(false);
      }
    } catch (err: any) {
      clearInterval(timer);
      if (err.name === 'AbortError') {
        setError("Save timed out. Please try again.");
      } else {
        console.error("Save error:", err);
        setError("An unexpected error occurred.");
      }
      setSaving(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  async function removeAt(i: number) {
    const path = images[i];
    const imgId = imageIds[i] || undefined;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      await fetch(`/api/media/delete`, { 
        method: "POST", 
        headers, 
        body: JSON.stringify({ path, imageId: imgId, listingId: id }),
        signal: controller.signal
      });
    } catch (err) {
      console.error("Delete media error:", err);
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (featuredIndex !== null) {
      if (i === featuredIndex) setFeaturedIndex(null);
      else if (i < featuredIndex) setFeaturedIndex(featuredIndex - 1);
    }
    setImages(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
    setImageIds(prev => prev.filter((_, idx) => idx !== i));
    setSelected(prev => prev.filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx));
  }
  function toggleSelected(i: number) { setSelected(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev, i]); }
  function clearSelection() { setSelected([]); }
  async function deleteSelected() {
    if (!selected.length) return;
    const sorted = [...selected].sort((a,b)=>b-a);
    openConfirm("Delete selected media?", async () => {
      for (const idx of sorted) { await removeAt(idx); }
      setSelectMode(false);
      setSelected([]);
    });
  }
  return (
    <div className="max-w-2xl card mx-auto">
      <h1 className="text-xl font-semibold mb-4">Edit Listing</h1>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Title</label><input className="input" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} /></div>
          <div><label className="label">Price</label><CurrencyInput className="input" value={form.price} onChange={val=>{
            const num = parseFloat(val);
            setForm({...form, price: isNaN(num) ? 0 : num});
          }} /></div>
          <div><label className="label">Status</label><select className="input" value={form.status} onChange={e=>setForm({...form, status: e.target.value})}><option>For Rent</option><option>For Sale</option><option>Preselling</option><option>RFO</option></select></div>
          <div><label className="label">Property Owner</label><input className="input" value={form.owner} onChange={e=>setForm({...form, owner: e.target.value})} /></div>
          <div>
            <label className="label">Property Type</label>
            <select className="input" value={form.type} onChange={e=>setForm({...form, type: e.target.value})}>
              <option>Condominium</option>
              <option>Town House</option>
              <option>Beach Property</option>
              <option>Lot Only</option>
              <option>House and Lot</option>
              <option>Industrial Properties</option>
              <option>Commercial Space</option>
            </select>
            {form.type === "Industrial Properties" && (
              <div className="mt-2">
                <label className="label">Industrial Subtype</label>
                <select className="input" value={form.industrySubtype} onChange={e=>setForm({...form, industrySubtype: e.target.value})}>
                  <option value="">Select</option>
                  <option>Office Space</option>
                  <option>Warehouse</option>
                </select>
              </div>
            )}
            {form.type === "Commercial Space" && (
              <div className="mt-2">
                <label className="label">Commercial Subtype</label>
                <select className="input" value={form.commercialSubtype} onChange={e=>setForm({...form, commercialSubtype: e.target.value})}>
                  <option value="">Select</option>
                  <option>Commercial Lot</option>
                  <option>Shop</option>
                  <option>Store</option>
                </select>
              </div>
            )}
          </div>
          <div><label className="label">Property Developer</label><input className="input" value={form.developer} onChange={e=>setForm({...form, developer: e.target.value})} /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input resize-none overflow-hidden" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} /></div>
          <div className="sm:col-span-2">
            <div className="card p-3 space-y-3">
              <div className="text-sm font-semibold">SEO</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">SEO Title</label>
                  <input className="input" placeholder="Recommended 50–60 chars" value={seoTitle} onChange={e=>setSeoTitle(e.target.value)} />
                </div>
                <div>
                  <label className="label">Focus Keyword</label>
                  <input className="input" placeholder="e.g., Cebu 3BR house for sale" value={seoKeyword} onChange={e=>setSeoKeyword(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">SEO Description</label>
                  <textarea className="input resize-none overflow-hidden" placeholder="Recommended 140–160 chars" value={seoDescription} onChange={e=>setSeoDescription(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                {(() => {
                  const t = (seoTitle || form.title).trim();
                  const d = (seoDescription || form.description).trim();
                  const kw = seoKeyword.trim().toLowerCase();
                  const tl = t.length;
                  const dl = d.length;
                  const wc = (form.description || "").trim().split(/\s+/).filter(Boolean).length;
                  const rt = Math.max(1, Math.round(wc / 200));
                  const kc = kw ? (t.toLowerCase().split(kw).length - 1) + (d.toLowerCase().split(kw).length - 1) : 0;
                  const slugBase = (form.title || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
                  const url = `https://phdreamhome.com/listing/${slugBase || "listing"}`;
                  const hasKw = (seoKeyword || "").trim().length > 0;
                  const hasImg = previews.length > 0;
                  const score =
                    (tl >= 50 && tl <= 60 ? 30 : 0) +
                    (dl >= 140 && dl <= 160 ? 30 : 0) +
                    (hasKw ? 20 : 0) +
                    (form.published ? 10 : 0) +
                    (hasImg ? 10 : 0);
                  return (
                    <>
                      <div className={`rounded px-2 py-1 ${tl >= 50 && tl <= 60 ? "bg-green-100" : "bg-slate-100"}`}>Title: {tl} chars</div>
                      <div className={`rounded px-2 py-1 ${dl >= 140 && dl <= 160 ? "bg-green-100" : "bg-slate-100"}`}>Description: {dl} chars</div>
                      <div className="rounded px-2 py-1 bg-slate-100">Keyword uses: {kc}</div>
                      <div className="rounded px-2 py-1 bg-slate-100">Read time: {rt} min</div>
                      <div className="sm:col-span-2 rounded px-2 py-1 bg-slate-100 truncate">URL: {url}</div>
                      <div className="sm:col-span-3 rounded px-3 py-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="font-medium">SEO Health</div>
                          <div>{score}%</div>
                        </div>
                        <div className="h-2 rounded bg-slate-200 overflow-hidden">
                          <div className={`h-full rounded ${score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-slate-400"}`} style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="mt-2 border-t pt-2">
                <div className="text-xs font-semibold mb-1">Search Result Preview</div>
                <div className="rounded border p-2">
                  <div className="text-[#1a0dab] text-sm">{(seoTitle || form.title || "Listing Title").trim()}</div>
                  <div className="text-[#006621] text-xs truncate">https://phdreamhome.com/listing/{(form.title || "listing").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-")}</div>
                  <div className="text-[#545454] text-xs">{(seoDescription || form.description || "Listing description").trim().slice(0, 160)}</div>
                </div>
              </div>
              <div className="mt-2 border-t pt-2">
                <div className="text-xs font-semibold mb-1">Suggested Keywords</div>
                {(() => {
                  const status = String(form.status || "").toLowerCase().replace(/\s+/g, " ");
                  const type = String(form.type || "").toLowerCase();
                  const city = String(form.city || "").toLowerCase();
                  const state = String(form.state || "").toLowerCase();
                  const br = Number(form.bedrooms) > 0 ? `${Number(form.bedrooms)}br` : "";
                  const base = [
                    [city, type, status].filter(Boolean).join(" "),
                    [state, type, status].filter(Boolean).join(" "),
                    [city, br, type].filter(Boolean).join(" "),
                    [city, "property", status].filter(Boolean).join(" "),
                    [city, "real estate"].filter(Boolean).join(" ")
                  ].map(s => s.trim()).filter(Boolean);
                  const uniq = Array.from(new Set(base)).slice(0, 6);
                  const parts = (seoKeyword || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
                  return (
                    <div className="flex flex-wrap gap-2">
                      {uniq.map(s => {
                        const selected = parts.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`text-xs rounded px-2 py-1 ${selected ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}
                            onClick={() => {
                              const cur = (seoKeyword || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
                              if (!cur.includes(s)) setSeoKeyword([...cur, s].join(", "));
                            }}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} /></div>
          <div><label className="label">City</label><input className="input" value={form.city} onChange={e=>setForm({...form, city: e.target.value})} /></div>
          <div><label className="label">Province</label><input className="input" value={form.state} onChange={e=>setForm({...form, state: e.target.value})} /></div>
          <div><label className="label">Country</label><input className="input" value={form.country} onChange={e=>setForm({...form, country: e.target.value})} /></div>
          <div><label className="label">Bedrooms</label><input type="number" className="input no-spin" value={form.bedrooms} onChange={e=>setForm({...form, bedrooms: Number(e.target.value)})} /></div>
          <div><label className="label">Bathrooms</label><input type="number" className="input no-spin" value={form.bathrooms} onChange={e=>setForm({...form, bathrooms: Number(e.target.value)})} /></div>
          <div><label className="label">Floor Area (Sqm)</label><input type="number" className="input no-spin" value={form.floorArea} onChange={e=>setForm({...form, floorArea: Number(e.target.value)})} /></div>
          <div><label className="label">Lot Area (Sqm)</label><input type="number" className="input no-spin" value={form.lotArea} onChange={e=>setForm({...form, lotArea: Number(e.target.value)})} /></div>
          <div><label className="label">Parking</label><input type="number" className="input no-spin" value={form.parking} onChange={e=>setForm({...form, parking: Number(e.target.value)})} /></div>
          <div className="sm:col-span-2 text-sm font-medium">Features and Amenities</div>
          <div className="sm:col-span-2">
            <label className="label">Indoor Features</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INDOOR_OPTIONS.map(o=> (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.indoorFeatures.includes(o)}
                    onChange={()=>{
                      const selected = form.indoorFeatures.includes(o);
                      const next = selected ? form.indoorFeatures.filter(x=>x!==o) : [...form.indoorFeatures, o];
                      setForm({...form, indoorFeatures: next});
                    }}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Outdoor Features</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OUTDOOR_OPTIONS.map(o=> (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.outdoorFeatures.includes(o)}
                    onChange={()=>{
                      const selected = form.outdoorFeatures.includes(o);
                      const next = selected ? form.outdoorFeatures.filter(x=>x!==o) : [...form.outdoorFeatures, o];
                      setForm({...form, outdoorFeatures: next});
                    }}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Upload Photo Here</label>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={upload} className="hidden" />
            <button type="button" aria-label="File Upload" onClick={()=>fileRef.current?.click()} className="inline-flex flex-col items-center gap-1">
              <span className="inline-flex items-center justify-center w-14 h-12 rounded bg-blue-500 text-white hover:bg-blue-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
                  <path d="M2 10a2 2 0 0 1 2-2h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8z"/>
                  <path d="M12 16V8"/>
                  <path d="M8.5 12.5L12 9l3.5 3.5"/>
                </svg>
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-slate-700">FILE UPLOAD</span>
            </button>
          </div>
          {uploading && (
            <div className="sm:col-span-2">
              <div className="h-2 bg-slate-200 rounded overflow-hidden">
                <div className="h-full bg-blue-500 rounded" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="text-xs mt-1 text-slate-600">{uploadProgress}%</div>
            </div>
          )}
          <div>
            <label className="label">Upload Video Here</label>
            <input ref={videoRef} type="file" accept="video/*" multiple onChange={upload} className="hidden" />
            <button type="button" aria-label="Video Upload" onClick={()=>videoRef.current?.click()} className="inline-flex flex-col items-center gap-1">
              <span className="inline-flex items-center justify-center w-14 h-12 rounded bg-blue-500 text-white hover:bg-blue-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
                  <rect x="3" y="5" width="14" height="14" rx="2"/>
                  <path d="M17 8l4 3v4l-4 3V8z"/>
                  <path d="M12 16V8"/>
                  <path d="M8.5 12.5L12 9l3.5 3.5"/>
                </svg>
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-slate-700">VIDEO UPLOAD</span>
            </button>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2 mb-2">
            <button type="button" className={`px-3 py-1 rounded ${selectMode ? "bg-blue-600 text-white" : "bg-slate-200"}`} onClick={()=>{ setSelectMode(!selectMode); if (!selectMode) setSelected([]); }}>
              {selectMode ? "Selection On" : "Selection Off"}
            </button>
            <button type="button" className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50" disabled={!selected.length} onClick={deleteSelected}>Delete Selected</button>
            <button type="button" className="px-3 py-1 rounded bg-slate-200" onClick={()=>setSelected(Array.from({length: previews.length}, (_,i)=>i))}>Select All</button>
            <button type="button" className="px-3 py-1 rounded bg-slate-200" onClick={clearSelection}>Clear</button>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            {previews.map((u, i) => {
              const path = images[i] || "";
              const obj = path.includes(":") ? path.split(":").pop() || path : path;
              const isVid = /\.(mp4|webm|ogg)$/i.test(obj);
              const key = imageIds[i] || `preview-${i}-${path}`;
              return (
                <div key={key} className={`relative ${selectMode ? "ring-2" : ""} ${selected.includes(i) ? "ring-blue-500" : "ring-transparent"}`}>
                  {isVid ? (
                    <video src={getProxyImageUrl(u)} muted autoPlay loop playsInline controlsList="nodownload" className="w-28 h-20 object-cover rounded" onClick={() => { if (selectMode) toggleSelected(i); }} />
                  ) : (
                    <Image src={getProxyImageUrl(u)} alt="preview" width={112} height={80} unoptimized className="object-cover rounded" onClick={() => { if (selectMode) toggleSelected(i); }} />
                  )}
                <button type="button" className={`absolute left-1 top-1 text-[10px] px-1.5 py-0.5 rounded ${featuredIndex===i?"bg-sky-500 text-white":"bg-white text-black border"}`} onClick={()=> setFeaturedIndex(i)}>{featuredIndex===i?"Feature":"Set as Feature"}</button>
                {!selectMode && (
                  <button type="button" onClick={()=> openConfirm("Delete this media?", () => removeAt(i))} className="absolute -top-2 -right-2 rounded-full bg-red-600 text-white w-6 h-6 flex items-center justify-center shadow">×</button>
                )}
                
                {selectMode && (
                  <input type="checkbox" checked={selected.includes(i)} onChange={()=>toggleSelected(i)} className="absolute -top-2 -left-2 w-5 h-5" />
                )}
              </div>
            );
          })}
        </div>
          {confirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="w-[92vw] max-w-sm rounded bg-white p-4 shadow-lg">
                <div className="text-sm font-medium mb-2">Confirm Delete</div>
                <div className="text-sm text-slate-700 mb-4">{confirmMessage}</div>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="px-3 py-1 rounded bg-slate-200" disabled={confirmLoading} onClick={()=>setConfirmOpen(false)}>Cancel</button>
                  <button type="button" className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50" disabled={confirmLoading} onClick={runConfirmOk}>Delete</button>
                </div>
              </div>
            </div>
          )}
          <div className="sm:col-span-2">
            <div className="text-sm font-medium mb-1">Land Marks</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <input key={i} className="input" placeholder={`Landmark ${i+1}`} value={(form.landmarks?.[i] ?? "")} onChange={e=>{
                  const next = [...(form.landmarks ?? [])]; next[i] = e.target.value; setForm({...form, landmarks: next});
                }} />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="published" type="checkbox" checked={form.published} onChange={e=>setForm({...form, published: e.target.checked})} />
            <label htmlFor="published">Published</label>
          </div>
        </div>
        <div className="mb-2" aria-live="polite" aria-atomic="true">
          {saving && (
            <div>
              <div className="text-sm font-medium mb-1">File Save</div>
              <div className="h-2 bg-slate-200 rounded overflow-hidden">
                <div className="h-full bg-blue-500 rounded" style={{ width: `${saveProgress}%` }} />
              </div>
              <div className="text-xs mt-1 text-slate-600">{saveProgress}%</div>
            </div>
          )}
          {saveMessage && (
            <div className="text-sm text-green-700 mt-1">{saveMessage}</div>
          )}
          {error && (
            <div className="text-sm text-red-600 mt-1">{error}</div>
          )}
        </div>
        <button className="btn-blue w-full disabled:opacity-50" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
      </form>
    </div>
  );
}

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <EditListingPageContent params={params} />
    </Suspense>
  );
}
