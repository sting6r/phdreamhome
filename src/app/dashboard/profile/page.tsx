"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@lib/supabase";

export default function ProfilePage() {
  const [form, setForm] = useState({ name: "", email: "", address: "", phone: "", image: "", role: "", licenseNo: "", dhsudAccredNo: "", facebook: "", whatsapp: "", viber: "", instagram: "", telegram: "", youtube: "", twitter: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{startX:number,startY:number}|null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile", { signal: controller.signal })
      .then(async r => {
        const text = await r.text();
        try {
          const j = JSON.parse(text);
          if (!r.ok) {
            throw new Error(j.error || `Failed to fetch profile (${r.status})`);
          }
          return j;
        } catch (e: any) {
          console.error("Profile fetch parse error. Status:", r.status, "Body:", text.slice(0, 200));
          throw new Error(e.message || "Invalid server response");
        }
      })
      .then(d => {
        setForm({ name: d.name || "", email: d.email || "", address: d.address || "", phone: d.phone || "", image: d.image || "", role: d.role || "", licenseNo: d.licenseNo || "", dhsudAccredNo: d.dhsudAccredNo || "", facebook: d.facebook || "", whatsapp: d.whatsapp || "", viber: d.viber || "", instagram: d.instagram || "", telegram: d.telegram || "", youtube: d.youtube || "", twitter: d.twitter || "" });
        
        // Prefer proxy URL for consistency and reliability
        const url = d.image 
          ? `/api/image/proxy?path=${encodeURIComponent(d.image)}` 
          : d.imageUrl;
          
        if (url) setAvatarUrl(url);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error("Profile fetch error:", err);
        setErr(err.message || "Failed to load profile");
      });
    return () => controller.abort();
  }, []);


  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    setDrag({ startX: e.clientX, startY: e.clientY });
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setDrag({ startX: e.clientX, startY: e.clientY });
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  }
  function onPointerUp() { setDrag(null); }

  const redraw = useCallback(() => {
    const c = canvasRef.current; const img = imgRef.current;
    if (!c || !img || !imageSrc) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = 240; c.height = 240;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.width/2, c.height/2, 100, 0, Math.PI*2);
    ctx.closePath();
    ctx.clip();
    const iw = img.naturalWidth; const ih = img.naturalHeight;
    const baseSize = Math.max(iw, ih);
    const s = (200 / baseSize) * scale;
    const drawW = iw * s; const drawH = ih * s;
    const x = c.width/2 - drawW/2 + offset.x;
    const y = c.height/2 - drawH/2 + offset.y;
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.restore();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c.width/2, c.height/2, 100, 0, Math.PI*2); ctx.stroke();
  }, [imageSrc, scale, offset]);

  useEffect(() => { redraw(); }, [redraw]);

  async function uploadCropped() {
    setErr(null);
    const c = canvasRef.current; if (!c) return;
    const blob: Blob | null = await new Promise(res => c.toBlob(b => res(b), "image/png", 0.92));
    if (!blob) return;
    const file = new File([blob], `avatar-${Date.now()}.png`, { type: "image/png" });
    const fd = new FormData(); fd.append("files", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd }); const d = await r.json();
    const path = d.paths?.[0]; const url = d.signedUrls?.[0];
    if (path && url) {
      setForm(f => ({ ...f, image: path }));
      setAvatarUrl(url);
      setCropping(false);
      setImageSrc(null);
      setScale(1); setOffset({ x: 0, y: 0 });
    } else {
      setErr("Failed to upload avatar");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setErr(null); setSaving(true);
    try {
      const body = { name: form.name, email: form.email, address: form.address, phone: form.phone, image: form.image, role: form.role, licenseNo: form.licenseNo, dhsudAccredNo: form.dhsudAccredNo, facebook: form.facebook, whatsapp: form.whatsapp, viber: form.viber, instagram: form.instagram, telegram: form.telegram, youtube: form.youtube, twitter: form.twitter };
      const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const j = await res.json().catch(()=>({})); setErr(j?.error || "Failed to save"); return; }
      setMsg("Saved");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null); setPwErr(null); setPwMsg(null); setChangingPw(true);
    try {
      if (!pw.current) throw new Error("Current password is required");
      if (!pw.next || pw.next.length < 8) throw new Error("New password must be at least 8 characters");
      if (pw.next !== pw.confirm) throw new Error("New passwords do not match");

      // Verify current password by attempting to sign in
      const email = form.email;
      if (!email) throw new Error("User email not found. Please refresh the page.");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: pw.current,
      });

      if (signInError) throw new Error("Incorrect current password");

      // Update password
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw new Error(error.message || "Failed to change password");

      setPwMsg("Password changed successfully");
      setPw({ current: "", next: "", confirm: "" });
    } catch (e:any) { 
      setPwErr(e.message || "Failed to change password"); 
    } finally { 
      setChangingPw(false); 
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setImageSrc(reader.result as string); };
    reader.readAsDataURL(f);
    setCropping(true);
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xl font-semibold text-blue-600">Edit Profile</div>
            <div className="text-xs text-black">Manage your public profile information.</div>
          </div>
        </div>
        <div className="flex flex-col items-center mb-4">
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center relative">
            {avatarUrl ? (
              <Image 
                src={avatarUrl} 
                alt={form.name || "avatar"} 
                fill 
                sizes="96px" 
                className="object-cover" 
                unoptimized
                onError={() => {
                  console.error("Profile: Avatar image failed to load:", avatarUrl);
                  setAvatarUrl(null);
                }}
              />
            ) : (
              <div className="text-gray-400 uppercase font-bold text-xl">
                {form.name ? form.name.charAt(0) : "?"}
              </div>
            )}
          </div>
          <div className="mt-2">

            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <button type="button" aria-label="Upload photo" className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-sky-500 text-white hover:bg-sky-400" onClick={()=>fileRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4 7h4l2-2h4l2 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path></svg>
            </button>
          </div>
        </div>
        {cropping && (
          <div className="rounded-md border p-3 mb-4">
            <div className="text-sm font-medium mb-2">Adjust and crop your photo</div>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative">
                <canvas ref={canvasRef} className="rounded-full bg-gray-100" width={240} height={240}
                  onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} />
              {imageSrc && (
                <Image src={imageSrc} alt="source" width={1} height={1} unoptimized className="hidden" onLoadingComplete={(img)=>{ imgRef.current = img; redraw(); }} />
              )}
              </div>
              <div className="flex flex-col gap-2 w-64">
                <label className="text-xs text-black">Zoom</label>
                <input type="range" min={1} max={3} step={0.01} value={scale} onChange={e=>setScale(Number(e.target.value))} />
                <div className="flex gap-2">
                  <button type="button" className="btn-blue" onClick={uploadCropped}>Crop & Upload</button>
                  <button type="button" className="btn-outline" onClick={()=>{ setCropping(false); setImageSrc(null); setScale(1); setOffset({x:0,y:0}); }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="your@email.com" />
            <div className="text-[10px] text-slate-500 mt-1">Note: Changing your email will require re-verification via the new email address.</div>
          </div>
          <div>
            <label className="label">Role</label>
            <input className="input" value={form.role} onChange={e=>setForm({...form, role: e.target.value})} placeholder="REAL ESTATE AGENT" />
          </div>
          <div>
            <label className="label">PRC Accred. No.</label>
            <input className="input" value={form.licenseNo} onChange={e=>setForm({...form, licenseNo: e.target.value})} placeholder="0007756" />
          </div>
          <div>
            <label className="label">DHSUD Accred. No.</label>
            <input className="input" value={form.dhsudAccredNo} onChange={e=>setForm({...form, dhsudAccredNo: e.target.value})} placeholder="HS-XXXXX" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Contact</label>
            <input className="input" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="0917 123 4567" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} placeholder="123 Main St, Anytown, USA" />
          </div>
          <div className="sm:col-span-2">
            <div className="text-sm font-medium text-blue-600">Social Media Account</div>
          </div>
          <div>
            <label className="label">Facebook</label>
            <input className="input" value={form.facebook} onChange={e=>setForm({...form, facebook: e.target.value})} placeholder="https://facebook.com/username" />
          </div>
          <div>
            <label className="label">Whatsapp</label>
            <input className="input" value={form.whatsapp} onChange={e=>setForm({...form, whatsapp: e.target.value})} placeholder="https://wa.me/number" />
          </div>
          <div>
            <label className="label">Viber</label>
            <input className="input" value={form.viber} onChange={e=>setForm({...form, viber: e.target.value})} placeholder="Viber contact" />
          </div>
          <div>
            <label className="label">Instagram</label>
            <input className="input" value={form.instagram} onChange={e=>setForm({...form, instagram: e.target.value})} placeholder="https://instagram.com/username" />
          </div>
          <div>
            <label className="label">Telegram</label>
            <input className="input" value={form.telegram} onChange={e=>setForm({...form, telegram: e.target.value})} placeholder="https://t.me/username" />
          </div>
          <div>
            <label className="label">Youtube</label>
            <input className="input" value={form.youtube} onChange={e=>setForm({...form, youtube: e.target.value})} placeholder="https://youtube.com/@channel" />
          </div>
          <div>
            <label className="label">Twitter</label>
            <input className="input" value={form.twitter} onChange={e=>setForm({...form, twitter: e.target.value})} placeholder="https://twitter.com/username" />
          </div>
          {err && <div className="sm:col-span-2 text-red-600 text-sm">{err}</div>}
          {msg && <div className="sm:col-span-2 text-green-600 text-sm">{msg}</div>}
          <div className="sm:col-span-2"><button className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></div>
        </form>
      </div>

      <div className="card">
        <div className="text-xl font-semibold mb-2 text-blue-600">Change Password</div>
      <div className="text-xs text-black mb-3">Update your password here. Use a strong, unique password.</div>
        <form onSubmit={changePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Current Password</label>
            <div className="relative">
              <input 
                type={showPw ? "text" : "password"} 
                className="input pr-10" 
                value={pw.current} 
                onChange={e=>setPw({...pw, current: e.target.value})} 
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.413 7.047 7.454 4 12 4s8.587 3.047 9.964 7.678c.04.135.04.274 0 .409C20.587 16.953 16.546 20 12 20s-8.587-3.047-9.964-7.678Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="sm:col-span-1">
            <label className="label">New Password</label>
            <div className="relative">
              <input 
                type={showPw ? "text" : "password"} 
                className="input pr-10" 
                value={pw.next} 
                onChange={e=>setPw({...pw, next: e.target.value})} 
              />
            </div>
          </div>
          <div className="sm:col-span-1">
            <label className="label">Confirm New Password</label>
            <div className="relative">
              <input 
                type={showPw ? "text" : "password"} 
                className="input pr-10" 
                value={pw.confirm} 
                onChange={e=>setPw({...pw, confirm: e.target.value})} 
              />
            </div>
          </div>
          {pwErr && <div className="sm:col-span-2 text-red-600 text-sm mb-1" role="alert" aria-live="polite">{pwErr}</div>}
          {pwMsg && <div className="sm:col-span-2 text-green-600 text-sm mb-1" role="status" aria-live="polite">{pwMsg}</div>}
          <div className="sm:col-span-2"><button className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={changingPw}>{changingPw ? "Changing..." : "Change Password"}</button></div>
        </form>
      </div>
    </div>
  );
}
