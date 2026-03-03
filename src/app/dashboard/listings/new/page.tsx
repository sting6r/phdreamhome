"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@lib/supabase";
import { getProxyImageUrl } from "@lib/image-utils";
import CurrencyInput from "@components/CurrencyInput";

const BLOG_ICON_CATEGORIES = [
  {
    name: "Prop",
    icons: ["🏠", "🏡", "🏘️", "🏙️", "🏢", "🏗️", "📐", "🛋️", "🛏️", "🛁", "🚿", "🚪", "🔑", "🗝️"]
  },
  {
    name: "Loc",
    icons: ["📍", "🗺️", "📞", "📧", "📱", "🌐", "📡", "📮"]
  },
  {
    name: "Biz",
    icons: ["💼", "💰", "💸", "💳", "📈", "📊", "📝", "📋", "🤝", "👔", "👨‍💼", "👩‍💼", "🏦"]
  },
  {
    name: "Tags",
    icons: ["✨", "💎", "⭐", "🌟", "🔥", "💥", "💯", "✅", "⚠️", "⚡", "💡"]
  },
  {
    name: "Plan",
    icons: ["📅", "📆", "🗓️", "⏰", "⏱️", "⏳"]
  },
  {
    name: "Life",
    icons: ["🌳", "🌴", "🌱", "🌿", "🍀", "🏊", "⛱️", "🏖️", "🚗", "🚲", "🛡️", "🔒", "🏋️", "🧘"]
  },
  {
    name: "Fest",
    icons: ["🎉", "🎊", "🎈", "🎁", "🔔", "📣", "📢", "🎯", "🏆", "🥇", "🥈", "🥉"]
  },
  {
    name: "Pub",
    icons: ["🏫", "🏪", "🏬", "🏨", "🏥", "🏛️", "⛪", "🕌"]
  }
];

function renderInlineFormatting(text: string) {
  if (typeof text !== "string") return text;
  if (text.trim() === "---") {
    return <hr className="my-6 border-t-2 border-slate-300" />;
  }
  const isList = /^[-•]\s+/.test(text);
  const cleanText = isList ? text.replace(/^[-•]\s+/, "") : text;

  const nodes: (string | React.ReactNode)[] = [];
  let key = 0;

  function pushFormattedSegment(segment: string) {
    const pattern = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(segment.slice(lastIndex, match.index));
      }
      if (match[1]) {
        nodes.push(
          <strong key={key++}>
            <em>{match[1]}</em>
          </strong>
        );
      } else if (match[2]) {
        nodes.push(<strong key={key++}>{match[2]}</strong>);
      } else if (match[3] || match[4]) {
        nodes.push(<em key={key++}>{match[3] || match[4]}</em>);
      }
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < segment.length) {
      nodes.push(segment.slice(lastIndex));
    }
  }

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      pushFormattedSegment(cleanText.slice(lastIndex, match.index));
    }
    const linkText = match[1];
    const href = match[2];
    nodes.push(
      <a
        key={key++}
        href={href}
        className="text-blue-600"
        target="_blank"
        rel="noopener noreferrer"
      >
        {linkText}
      </a>
    );
    lastIndex = linkPattern.lastIndex;
  }
  if (lastIndex < cleanText.length) {
    pushFormattedSegment(cleanText.slice(lastIndex));
  }

  if (isList) {
    return (
      <div className="flex items-start gap-1.5 ml-1">
        <span className="mt-1 w-1 h-1 rounded-full bg-orange-600 shrink-0" />
        <div className="flex-1">{nodes}</div>
      </div>
    );
  }

  return nodes;
}

export default function NewListingPage() {
  const [showIconMenu, setShowIconMenu] = useState(false);
  const [activeIconCategory, setActiveIconCategory] = useState(BLOG_ICON_CATEGORIES[0].name);
  const [showLinkConfig, setShowLinkConfig] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkSelStart, setLinkSelStart] = useState<number | null>(null);
  const [linkSelEnd, setLinkSelEnd] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const seoDescRef = useRef<HTMLTextAreaElement | null>(null);
  const iconMenuRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef<HTMLDivElement | null>(null);
  
  // Tools sticky state
  const [toolsLocked, setToolsLocked] = useState(false);
  const [toolsBox, setToolsBox] = useState<{ left: number; width: number } | null>(null);
  const toolsLockedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [images, setImages] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // featuredIndex removed
  const [error, setError] = useState<string | null>(null);

  function moveToStart(index: number) {
    if (index === 0) return;
    const newImages = [...images];
    const newPreviews = [...previews];
    
    const [movedImage] = newImages.splice(index, 1);
    const [movedPreview] = newPreviews.splice(index, 1);
    
    newImages.unshift(movedImage);
    newPreviews.unshift(movedPreview);
    
    setImages(newImages);
    setPreviews(newPreviews);
  }
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    if (selectMode) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Transparent drag image or default
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newImages = [...images];
    const newPreviews = [...previews];
    
    const [movedImage] = newImages.splice(draggedIndex, 1);
    const [movedPreview] = newPreviews.splice(draggedIndex, 1);
    
    newImages.splice(targetIndex, 0, movedImage);
    newPreviews.splice(targetIndex, 0, movedPreview);
    
    setImages(newImages);
    setPreviews(newPreviews);
    
    setDraggedIndex(null);
  }

  const INDOOR_OPTIONS = [
    "Alarm System","Balcony","Basement","Drivers Room","Ensuite","Bar","Terrace","Maids Room","Library","Air-Conditioning","Attic","CCTV","Broadband Internet","Cable","Built-in Wardrobes","Central Air","Ducted Cooling","Entertainment Room","Fire Alarm","Fireplace","Floorboards","Gym","Jacuzzi","Lounge","Pay TV Access","Powder Room","Sauna","Smoke Detector","Hot Shower","WIFI","Pets Allowed","Storage Room","Study Room"
  ];
  const OUTDOOR_OPTIONS = [
    "Badminton Court","Carport","Courtyard","Fully Fenced","Garage","Helipad","Jogging Path","Open Car Spaces","Secure Parking","Parks","Shower Rooms","Sport Facility","Swimming Pool","Club House","Tennis Court","Function Area","24-Hour Security","Balcony","Playground","Basketball Court","Garden","Gazebo","Jacuzzi","Landscape Garden","Multi Purpose Lawn","Parking Lot","Remote Garden","Volley Ball Court","Open Space","Commercial Stores"
  ];
  const [form, setForm] = useState({
    title: "", description: "", price: 0, address: "", city: "", state: "", country: "",
    bedrooms: 0, bathrooms: 0, floorArea: 0, lotArea: 0, parking: 0, indoorFeatures: [] as string[], outdoorFeatures: [] as string[], landmarks: [] as string[], owner: "", developer: "", status: "For Rent", type: "Condominium", published: true, industrySubtype: "", commercialSubtype: "",
    indoorFeatureTexts: Array.from({ length: 10 }).map(() => ""),
    outdoorFeatureTexts: Array.from({ length: 10 }).map(() => "")
  });
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeyword, setSeoKeyword] = useState("");
    useEffect(() => {
    function measureToolsBox() {
      const container = document.getElementById("tools-container-anchor");
      if (container) {
        const rect = container.getBoundingClientRect();
        setToolsBox({ left: rect.left, width: rect.width });
      }
    }

    function handleScroll() {
      const anchor = document.getElementById("tools-container-anchor");
      
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        if (rect.top <= 60) { // Approx header height or just top
          if (!toolsLockedRef.current) {
            toolsLockedRef.current = true;
            setToolsLocked(true);
            measureToolsBox();
          }
        } else {
          if (toolsLockedRef.current) {
            toolsLockedRef.current = false;
            setToolsLocked(false);
          }
        }
      }
    }

    function handleResize() {
      measureToolsBox();
    }

    window.addEventListener("scroll", handleScroll, { passive: true } as any);
    window.addEventListener("resize", handleResize, { passive: true } as any);
    measureToolsBox();
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  function applyTool(tool: "bold" | "italic" | "list" | "separator") {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = form.description || "";
    const selected = start !== end ? value.slice(start, end) : "";
    
    let next = value;
    let newCursorPos = end;

    if (tool === "bold") {
        const target = selected || "text";
        next = value.slice(0, start) + `**${target}**` + value.slice(end);
        newCursorPos = start + 2 + target.length + 2;
    } else if (tool === "italic") {
        const target = selected || "text";
        next = value.slice(0, start) + `_${target}_` + value.slice(end);
        newCursorPos = start + 1 + target.length + 1;
    } else if (tool === "list") {
        if (start === end) {
            const lineStart = value.lastIndexOf("\n", start - 1) + 1;
            const alreadyList = value.slice(lineStart, lineStart + 2) === "• ";
            if (!alreadyList) {
                next = value.slice(0, lineStart) + "• " + value.slice(lineStart);
                newCursorPos = start + 2;
            }
        } else {
             const segmentStart = value.lastIndexOf("\n", start - 1) + 1;
             const segmentEndIndex = value.indexOf("\n", end);
             const segmentEnd = segmentEndIndex === -1 ? value.length : segmentEndIndex;
             const segment = value.slice(segmentStart, segmentEnd);
             const lines = segment.split("\n");
             const transformed = lines.map(l => (l.startsWith("• ") ? l : `• ${l}`)).join("\n");
             next = value.slice(0, segmentStart) + transformed + value.slice(segmentEnd);
             newCursorPos = segmentStart + transformed.length;
        }
    } else if (tool === "separator") {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const alreadySep = value.slice(lineStart, lineStart + 4) === "---\n";
        if (!alreadySep) {
            next = value.slice(0, lineStart) + "---\n" + value.slice(lineStart);
            newCursorPos = lineStart + 4;
        }
    }

    if (next !== value) {
        setForm(prev => ({ ...prev, description: next }));
        setTimeout(() => {
            if (descRef.current) {
                descRef.current.focus();
                descRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    }
  }

  function insertIcon(icon: string) {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = form.description || "";
    const next = value.slice(0, start) + icon + value.slice(end);
    setForm(prev => ({ ...prev, description: next }));
    setShowIconMenu(false);
    setTimeout(() => {
        if (descRef.current) {
            descRef.current.focus();
            descRef.current.setSelectionRange(start + icon.length, start + icon.length);
        }
    }, 0);
  }

  function openLinkConfig() {
    const el = descRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = form.description || "";
    const selected = value.slice(start, end);
    setLinkText(selected);
    setLinkUrl("");
    setLinkSelStart(start);
    setLinkSelEnd(end);
    setShowLinkConfig(true);
  }

  function applyLink() {
      if (!linkUrl) {
          setShowLinkConfig(false);
          return;
      }
      const value = form.description || "";
      const start = linkSelStart ?? 0;
      const end = linkSelEnd ?? 0;
      const textToUse = linkText || "link";
      const link = `[${textToUse}](${linkUrl})`;
      const next = value.slice(0, start) + link + value.slice(end);
      
      setForm(prev => ({ ...prev, description: next }));
      setShowLinkConfig(false);
      setTimeout(() => {
          if (descRef.current) {
              descRef.current.focus();
              descRef.current.setSelectionRange(start + link.length, start + link.length);
          }
      }, 0);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!form.title) {
      alert("Please enter a property title before uploading images.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const files = e.target.files;
    if (!files || !files.length) return;
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("files", f));
    fd.append("propertyName", form.title);
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
              setImages(prev => {
                const next = [...prev, ...(data.paths as string[])];
                return next;
              });
              setPreviews(prev => {
                const next = [...prev, ...(data.signedUrls as string[])];
                return next;
              });
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
    if (saving) return;
    setError(null);
    setSaveMessage(null);
    setSaving(true);
    setSaveProgress(10);
    const timer = setInterval(() => setSaveProgress(p => Math.min(95, p + 5)), 200);
    try {
      const indoorTexts = Array.isArray((form as any).indoorFeatureTexts) ? ((form as any).indoorFeatureTexts as string[]).map(s => (s || "").trim()).filter(Boolean) : [];
      const outdoorTexts = Array.isArray((form as any).outdoorFeatureTexts) ? ((form as any).outdoorFeatureTexts as string[]).map(s => (s || "").trim()).filter(Boolean) : [];
      const validLandmarks = (form.landmarks || []).filter(l => l && l.trim().length > 0);
      const payload = { 
        ...form, 
        indoorFeatures: Array.from(new Set([...(form.indoorFeatures || []), ...indoorTexts])), 
        outdoorFeatures: Array.from(new Set([...(form.outdoorFeatures || []), ...outdoorTexts])), 
        landmarks: validLandmarks,
        images: images 
      };
      (payload as any).seoTitle = seoTitle;
      (payload as any).seoDescription = seoDescription;
      (payload as any).seoKeyword = seoKeyword;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string,string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch("/api/listings", { 
          method: "POST", 
          headers, 
          body: JSON.stringify(payload),
          signal: controller.signal 
        });

        clearInterval(timer);
        const text = await res.text();
        let j;
        try {
          j = JSON.parse(text);
        } catch (e) {
          console.error("Listing save parse error. Status:", res.status, "Body:", text.slice(0, 200));
          j = { error: "Invalid server response" };
        }

        if (res.ok) {
          setSaveProgress(100);
          setSaveMessage("Saved");
          setTimeout(() => { window.location.href = "/dashboard/properties"; }, 750);
          return;
        }
        
        console.error("Save failed response:", j);
        const msg = j.details || (Array.isArray(j.issues) && j.issues.length ? j.issues[0] : j.error);
        setError(msg || "Failed to save");
        setSaving(false);
      } catch (err: any) {
        clearInterval(timer);
        if (err.name === 'AbortError') {
          setError("Save timed out. Please try again.");
        } else {
          console.error("Save error:", err);
          setError(err.message || "Failed to save");
        }
        setSaving(false);
      } finally {
        clearTimeout(timeoutId);
      }
  } catch (e: any) {
    setError(e?.message || "Failed to save");
    setSaving(false);
  } finally {
    clearInterval(timer);
  }
}

  useEffect(() => {
    const adjustHeight = (el: HTMLTextAreaElement) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    const textareas = formRef.current?.querySelectorAll("textarea");
    textareas?.forEach(el => adjustHeight(el as HTMLTextAreaElement));
  }, [form.description, seoDescription, form.indoorFeatureTexts, form.outdoorFeatureTexts]);

  async function removeAt(i: number) {
    const path = images[i];
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
        body: JSON.stringify({ path }),
        signal: controller.signal
      });
    } catch (err) {
      console.error("Delete media error:", err);
    } finally {
      clearTimeout(timeoutId);
    }
    
    setImages(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
    setSelected(prev => prev.filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx));
  }
  function toggleSelected(i: number) { setSelected(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev, i]); }
  function clearSelection() { setSelected([]); }
  async function deleteSelected() {
    if (!selected.length) return;
    const sorted = [...selected].sort((a,b)=>b-a);
    for (const idx of sorted) { await removeAt(idx); }
    setSelectMode(false);
    setSelected([]);
  }
  return (
    <div className="max-w-2xl card mx-auto">
      <h1 className="text-xl font-semibold mb-4">New Listing</h1>
      <form ref={formRef} onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Title</label><input className="input" placeholder="e.g., Cozy 3BR Family Home" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} /></div>
          <div>
            <label className="label">Price</label>
              <CurrencyInput
                className="input"
                placeholder="2,500,000.00"
                value={form.price}
                onChange={val => {
                  const num = parseFloat(val);
                  setForm({ ...form, price: isNaN(num) ? 0 : num });
                }}
              />
          </div>
          <div><label className="label">Status</label><select className="input" value={form.status} onChange={e=>setForm({...form, status: e.target.value})}><option>For Rent</option><option>For Sale</option><option>Preselling</option><option>RFO</option></select></div>
          <div><label className="label">Property Owner</label><input className="input" placeholder="e.g., Juan Dela Cruz" value={form.owner} onChange={e=>setForm({...form, owner: e.target.value})} /></div>
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
          <div><label className="label">Property Developer</label><input className="input" placeholder="e.g., Ayala Land" value={form.developer} onChange={e=>setForm({...form, developer: e.target.value})} /></div>
          <div className="sm:col-span-2">
            <div id="tools-container-anchor" className="w-full relative mb-1">
              <div
                id="tools-container"
                className={`w-full bg-[#EFDCEC] transition-all z-40 ${
                  toolsLocked
                    ? "fixed top-[60px] left-0 right-0 shadow-md border-b"
                    : "relative border rounded-md shadow-sm"
                }`}
                style={
                  toolsLocked && toolsBox
                    ? {
                        left: toolsBox.left,
                        width: toolsBox.width,
                        top: 60,
                      }
                    : {}
                }
              >
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-4 py-2 w-full sm:overflow-x-auto no-scrollbar">
                  <div className="text-xs font-semibold text-slate-700 mr-4">Listing Tool Bar</div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTool("bold")}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTool("italic")}
                    >
                      /
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors flex items-center justify-center"
                      aria-label="Insert separator"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTool("separator")}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="4" y1="12" x2="20" y2="12" />
                      </svg>
                    </button>
                    
                    {/* Icon Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors flex items-center gap-1"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowIconMenu(!showIconMenu)}
                        aria-label="Text icon menu"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                          <line x1="9" y1="9" x2="9.01" y2="9" />
                          <line x1="15" y1="9" x2="15.01" y2="9" />
                        </svg>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTool("list")}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-white/40 transition-colors"
                      aria-label="Insert link"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={openLinkConfig}
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
                          <path d="M9.5 14.5L8 16a3 3 0 104.24 4.24l2-2A3 3 0 0013 12.5M14.5 9.5L16 8a3 3 0 10-4.24-4.24l-2 2A3 3 0 0011 11.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Icon Menu Dropdown - Outside inner scroll container */}
                {showIconMenu && (
                  <div
                    ref={iconMenuRef}
                    className="absolute top-full left-4 mt-1 bg-white border rounded-md shadow-lg z-50 min-w-[280px] flex flex-col"
                  >
                     <div className="flex border-b overflow-x-auto no-scrollbar bg-slate-50 rounded-t-md p-1 gap-1">
                      {BLOG_ICON_CATEGORIES.map(cat => (
                        <button
                          key={cat.name}
                          type="button"
                          className={`px-2 py-1 text-[10px] font-medium rounded transition-colors whitespace-nowrap ${
                            activeIconCategory === cat.name
                              ? "bg-white text-blue-600 shadow-sm"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                          onClick={() => setActiveIconCategory(cat.name)}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <div className="p-2 grid grid-cols-7 gap-1 max-h-[220px] overflow-y-auto custom-scrollbar">
                      {BLOG_ICON_CATEGORIES.find(c => c.name === activeIconCategory)?.icons.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-lg transition-colors"
                          onClick={() => insertIcon(icon)}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Link Config Modal */}
              {showLinkConfig && (
                  <div className="absolute top-10 left-0 z-50 bg-white border rounded-md shadow-lg p-3 w-72">
                    <div className="mb-2 text-xs font-semibold">Insert Link</div>
                    <div className="space-y-2">
                        <div>
                            <label className="text-[10px] text-slate-500">Text</label>
                            <input className="w-full text-xs border rounded px-2 py-1" value={linkText} onChange={e => setLinkText(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500">URL</label>
                            <input className="w-full text-xs border rounded px-2 py-1" placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} autoFocus />
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                                onClick={() => setShowLinkConfig(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                onClick={applyLink}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                  </div>
              )}
              </div>
            </div>
            <label className="label">Description</label>
            <textarea
              ref={descRef}
              suppressHydrationWarning
              className="input resize-none overflow-hidden"
              placeholder="e.g., Bright living room, modern kitchen, near schools and parks"
              value={form.description}
              onChange={e=>setForm({...form, description: e.target.value})}
            />
          </div>
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
                  <textarea ref={seoDescRef} suppressHydrationWarning className="input resize-none overflow-hidden" placeholder="Recommended 140–160 chars" value={seoDescription} onChange={e=>setSeoDescription(e.target.value)} />
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
          <div><label className="label">Address</label><input className="input" placeholder="e.g., 123 Mango St." value={form.address} onChange={e=>setForm({...form, address: e.target.value})} /></div>
          <div><label className="label">City</label><input className="input" placeholder="e.g., Quezon City" value={form.city} onChange={e=>setForm({...form, city: e.target.value})} /></div>
          <div><label className="label">Province</label><input className="input" placeholder="e.g., Metro Manila" value={form.state} onChange={e=>setForm({...form, state: e.target.value})} /></div>
          <div><label className="label">Country</label><input className="input" placeholder="e.g., Philippines" value={form.country} onChange={e=>setForm({...form, country: e.target.value})} /></div>
          <div><label className="label">Bedrooms</label><input type="number" className="input no-spin" placeholder="e.g., 3" value={form.bedrooms || ""} onChange={e=>setForm({...form, bedrooms: Number(e.target.value)})} /></div>
          <div><label className="label">Bathrooms</label><input type="number" className="input no-spin" placeholder="e.g., 2" value={form.bathrooms || ""} onChange={e=>setForm({...form, bathrooms: Number(e.target.value)})} /></div>
          <div><label className="label">Floor Area (Sqm)</label><input type="number" className="input no-spin" placeholder="e.g., 76" value={form.floorArea || ""} onChange={e=>setForm({...form, floorArea: Number(e.target.value)})} /></div>
          <div><label className="label">Lot Area (Sqm)</label><input type="number" className="input no-spin" placeholder="e.g., 60" value={form.lotArea || ""} onChange={e=>setForm({...form, lotArea: Number(e.target.value)})} /></div>
          <div><label className="label">Parking</label><input type="number" className="input no-spin" placeholder="e.g., 1" value={form.parking || ""} onChange={e=>setForm({...form, parking: Number(e.target.value)})} /></div>
          <div className="sm:col-span-2 text-sm font-medium">Features and Amenities</div>
          <div className="sm:col-span-2">
            <label className="label">Indoor Features</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INDOOR_OPTIONS.map(o=> (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.indoorFeatures.includes(o)}
                        onChange={(e)=>{
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
              <div>
                <div className="text-xs font-medium text-slate-700 mb-1">Paragraph Features</div>
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <textarea
                      key={i}
                      className="input resize-none overflow-hidden"
                      placeholder={`Feature Paragraph ${i+1}`}
                      value={form.indoorFeatureTexts[i] || ""}
                      onChange={(e)=>{
                        const arr = [...form.indoorFeatureTexts];
                        arr[i] = e.target.value;
                        setForm({ ...form, indoorFeatureTexts: arr });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Outdoor Features</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
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
                <div className="text-xs font-medium text-slate-700 mb-1">Paragraph Features</div>
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <textarea
                      key={i}
                      className="input resize-none overflow-hidden"
                      placeholder={`Feature Paragraph ${i+1}`}
                      value={form.outdoorFeatureTexts[i] || ""}
                      onChange={(e)=>{
                        const arr = [...form.outdoorFeatureTexts];
                        arr[i] = e.target.value;
                        setForm({ ...form, outdoorFeatureTexts: arr });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            {([form.address, form.city, form.state, form.country].filter(Boolean).join(", ") || "").length > 0 && (
              <div className="rounded-md overflow-hidden border border-gray-200">
                <iframe
                  title="map"
                  src={`https://www.google.com/maps?q=${encodeURIComponent([form.address, form.city, form.state, form.country].filter(Boolean).join(", "))}&output=embed`}
                  className="w-full h-64"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <div className="text-sm font-medium mb-1">Land Marks</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <input key={i} className="input" placeholder={`Landmark ${i+1}`} value={form.landmarks[i] || ""} onChange={e=>{
                  const next = [...form.landmarks]; next[i] = e.target.value; setForm({...form, landmarks: next});
                }} />
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
          {uploading && (
            <div className="sm:col-span-2">
              <div className="h-2 bg-slate-200 rounded overflow-hidden">
                <div className="h-full bg-blue-500 rounded" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="text-xs mt-1 text-slate-600">{uploadProgress}%</div>
            </div>
          )}
          <div className="sm:col-span-2">
            {previews.length > 0 && <div className="text-xs text-black mb-1">Select a main photo to feature</div>}
            {previews.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <button type="button" className={`px-3 py-1 rounded ${selectMode ? "bg-blue-600 text-white" : "bg-slate-200"}`} onClick={()=>{ setSelectMode(!selectMode); if (!selectMode) setSelected([]); }}>
                  {selectMode ? "Selection On" : "Selection Off"}
                </button>
                <button type="button" className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50" disabled={!selected.length} onClick={deleteSelected}>Delete Selected</button>
                <button type="button" className="px-3 py-1 rounded bg-slate-200" onClick={()=>setSelected(Array.from({length: previews.length}, (_,i)=>i))}>Select All</button>
                <button type="button" className="px-3 py-1 rounded bg-slate-200" onClick={clearSelection}>Clear</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {previews.map((u, i) => {
                const path = images[i] || "";
                const obj = path.includes(":") ? path.split(":").pop() || path : path;
                const isVid = /\.(mp4|webm|ogg)$/i.test(obj);
                const key = `preview-${i}-${path}`;
                return (
                  <div 
                    key={key} 
                    className={`relative ${selectMode ? "ring-2 cursor-pointer" : "cursor-move"} ${selected.includes(i) ? "ring-blue-500" : "ring-transparent"} ${draggedIndex === i ? "opacity-50" : ""}`}
                    draggable={!selectMode}
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, i)}
                  >
                    {isVid ? (
                      <video src={getProxyImageUrl(u)} muted autoPlay loop playsInline controlsList="nodownload" className="w-28 h-20 object-cover rounded border border-gray-200" onClick={() => { if (selectMode) toggleSelected(i); }} />
                    ) : (
                      <Image src={getProxyImageUrl(u)} alt="preview" width={112} height={80} unoptimized className="object-cover rounded border border-gray-200" onClick={() => { if (selectMode) toggleSelected(i); }} />
                    )}
                    <button type="button" className={`absolute left-1 top-1 text-[10px] px-1.5 py-0.5 rounded ${i===0?"bg-sky-500 text-white":"bg-white text-black border"}`} onClick={()=>moveToStart(i)}>{i===0?"Feature":"Set as Feature"}</button>
                    {!selectMode && (
                      <button type="button" onClick={()=> removeAt(i)} className="absolute -top-2 -right-2 rounded-full bg-red-600 text-white w-6 h-6 flex items-center justify-center shadow">×</button>
                    )}
                    {selectMode && (
                      <input type="checkbox" checked={selected.includes(i)} onChange={()=>toggleSelected(i)} className="absolute -top-2 -left-2 w-5 h-5" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="published" type="checkbox" checked={form.published} onChange={e=>setForm({...form, published: e.target.checked})} />
            <label htmlFor="published">Publish on save</label>
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
          <button className="btn-blue w-full disabled:opacity-50" disabled={saving}>
            {saving ? "Saving..." : "Save Listing"}
          </button>
      </form>
    </div>
  );
}
