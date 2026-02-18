"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { supabase } from "@lib/supabase";
import CurrencyInput from "@components/CurrencyInput";
import SalesRentalDetailCard from "@components/SalesRentalDetailCard";

const fetcher = async (u: string, { signal }: { signal?: AbortSignal } = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 30000); // 10s timeout

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
    try {
      const json = JSON.parse(text);
      if (!r.ok) throw new Error(json.error || `Fetch failed: ${r.status}`);
      return json;
    } catch (e: any) {
      if (isAbortError(e)) return null;
      console.warn("Sales fetcher parse warning:", u, r.status);
      return null;
    }
  } catch (err: any) {
    if (isAbortError(err)) return null;
    const msg = String(err?.message || "").toLowerCase();
    if (err instanceof TypeError && (msg.includes("failed to fetch") || msg.includes("network"))) return null;
    console.warn("Sales fetcher warning:", err?.message || err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const STATUS_CATEGORIES = ["In Progress", "Closed", "Cancelled"];

const Icons = {
  Plus: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  ),
  MoreVertical: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
  ),
  Pencil: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
  ),
  Trash2: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  ),
  Calendar: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
  )
};

export default function SalesPage() {
  const swrCfg = { onError: (err: any) => { const msg = String(err?.message || ""); if (err?.name === "AbortError" || /abort/.test(msg)) return; } };
  const { data: salesData, error: salesError, mutate: mutateSales } = useSWR("/api/sales", fetcher, swrCfg);
  const { data: listingsData, error: listingsError } = useSWR("/api/listings", fetcher, swrCfg);
  
  const sales = Array.isArray(salesData) ? salesData : null;
  const listings = listingsData?.listings ?? [];

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("In Progress");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [clientInfoOpen, setClientInfoOpen] = useState(true);
  const [formData, setFormData] = useState({
    listingId: "",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientMessenger: "",
    clientPhone: "",
    roomNo: "",
    floor: "",
    amount: "",
    salesCategory: "Sale",
    saleDate: "",
    rentalStartDate: "",
    rentalDueDate: "",
    advanceDeposit: "",
    advanceDepositMonths: "",
    securityDeposit: "",
    securityDepositMonths: "",
    notes: "",
  });

  useEffect(() => {
    if (!editingId && !isFormOpen) {
      setFormData(prev => ({
        ...prev,
        saleDate: new Date().toISOString().split("T")[0]
      }));
    }
  }, [isFormOpen, editingId]);

  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  // Auto-resize textarea logic
  useEffect(() => {
    const adjustHeight = (el: HTMLTextAreaElement) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    const textareas = document.querySelectorAll("textarea");
    textareas.forEach(el => adjustHeight(el as HTMLTextAreaElement));
  }, [isFormOpen, formData.notes]);

  // Draggable Modal Logic
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const liveSale = useMemo(() => {
    if (!selectedSale) return null;
    if (isFormOpen && editingId && selectedSale.id === editingId) {
      let notesObj: any = {};
      try {
        notesObj = selectedSale.notes ? JSON.parse(selectedSale.notes) : {};
      } catch {
        notesObj = {};
      }
      const nextMeta = { ...(notesObj.meta || {}) };
      if (typeof formData.roomNo === "string") nextMeta.roomNo = formData.roomNo;
      if (typeof formData.floor === "string") nextMeta.floor = formData.floor;
      const nextNotes = { ...notesObj, meta: nextMeta };
      return { ...selectedSale, roomNo: formData.roomNo, floor: formData.floor, notes: JSON.stringify(nextNotes) };
    }
    return selectedSale;
  }, [selectedSale, isFormOpen, editingId, formData.roomNo, formData.floor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from the header, not its children buttons
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - modalPos.x,
      y: e.clientY - modalPos.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setModalPos({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

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

  const handleEmailChange = (val: string) => {
    setFormData({ ...formData, clientEmail: val });
    setEmailSuggestion(getEmailSuggestion(val));
  };

  const resetForm = () => {
    setFormData({
      listingId: "",
      clientName: "",
      clientAddress: "",
      clientEmail: "",
      clientMessenger: "",
      clientPhone: "",
      roomNo: "",
      floor: "",
      amount: "",
      salesCategory: "Sale",
      saleDate: new Date().toISOString().split("T")[0],
      rentalStartDate: "",
      rentalDueDate: "",
      advanceDeposit: "",
      advanceDepositMonths: "",
      securityDeposit: "",
      securityDepositMonths: "",
      notes: "",
    });
    setActiveTab("In Progress");
    setEditingId(null);
    setIsFormOpen(false);
    setEmailSuggestion(null);
    setModalPos({ x: 0, y: 0 }); // Reset position when closing
  };

  const handleEdit = (sale: any) => {
    setEditingId(sale.id);
    let notesText = sale.notes || "";
    let advMonths = "";
    let secMonths = "";
    let advAmtStr = "";
    let secAmtStr = "";
    try {
      if (sale.notes) {
        const parsed = JSON.parse(sale.notes);
        if (Array.isArray(parsed)) {
          notesText = "";
        } else if (parsed && typeof parsed === "object") {
          notesText = typeof parsed.text === "string" ? parsed.text : "";
          if (parsed.deposits && typeof parsed.deposits === "object") {
            if (typeof parsed.deposits.advanceMonths === "number") advMonths = String(parsed.deposits.advanceMonths);
            if (typeof parsed.deposits.securityMonths === "number") secMonths = String(parsed.deposits.securityMonths);
            if (typeof parsed.deposits.advanceAmount === "number") {
              advAmtStr = parsed.deposits.advanceAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            if (typeof parsed.deposits.securityAmount === "number") {
              secAmtStr = parsed.deposits.securityAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
          }
        }
      }
    } catch {}
    setFormData({
      listingId: sale.listingId || "",
      clientName: sale.clientName,
      clientAddress: sale.clientAddress || "",
      clientEmail: sale.clientEmail || "",
      clientMessenger: sale.clientMessenger || "",
      clientPhone: sale.clientPhone || "",
      roomNo: sale.roomNo || "",
      floor: sale.floor || "",
      amount: (sale.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      salesCategory: sale.salesCategory || "Sale",
      saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      rentalStartDate: sale.rentalStartDate ? new Date(sale.rentalStartDate).toISOString().split("T")[0] : "",
      rentalDueDate: sale.rentalDueDate ? new Date(sale.rentalDueDate).toISOString().split("T")[0] : "",
      advanceDeposit: advAmtStr,
      advanceDepositMonths: advMonths,
      securityDeposit: secAmtStr,
      securityDepositMonths: secMonths,
      notes: notesText,
    });
    setActiveTab(sale.status);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sale record?")) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        await fetch(`/api/sales/${id}`, { 
          method: "DELETE", 
          headers,
          signal: controller.signal
        });
        mutateSales();
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (err?.name === 'AbortError' || (err instanceof TypeError && (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("abort")))) {
          console.warn("Delete sale request aborted/timeout or network issue");
        } else {
          console.error("Delete sale error:", err);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: any) {
      console.error("Delete outer error:", e);
    }
  };

  const formatAmount = (value: string) => {
    // Remove all non-digits except for the decimal point
    const cleanValue = value.replace(/[^\d.]/g, "");
    
    // Split into integer and decimal parts
    const parts = cleanValue.split(".");
    let integerPart = parts[0];
    const decimalPart = parts[1];

    // Add commas to the integer part
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Reconstruct the value
    if (parts.length > 1) {
      return `${integerPart}.${decimalPart.slice(0, 2)}`;
    }
    return integerPart;
  };

  const formatPhone = (value: string) => {
    // Remove all non-digits
    const cleanValue = value.replace(/\D/g, "");
    // Limit to 11 digits
    return cleanValue.slice(0, 11);
  };

  const handleAmountBlur = () => {
    if (!formData.amount) return;
    const num = parseFloat(formData.amount.replace(/,/g, ""));
    if (!isNaN(num)) {
      setFormData({
        ...formData,
        amount: num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.clientPhone && formData.clientPhone.length !== 11) {
      alert("Please enter a valid 11-digit mobile number.");
      return;
    }

    // Strip commas before sending to API
    const amountValue = formData.amount.replace(/,/g, "");
    const advMonthsNum = Number(formData.advanceDepositMonths);
    const secMonthsNum = Number(formData.securityDepositMonths);
    const advAmtNum = formData.advanceDeposit ? Number(formData.advanceDeposit.replace(/,/g, "")) : NaN;
    const secAmtNum = formData.securityDeposit ? Number(formData.securityDeposit.replace(/,/g, "")) : NaN;
    const depositConfig: any = {};
    if (!Number.isNaN(advMonthsNum) && advMonthsNum >= 0) depositConfig.advanceMonths = advMonthsNum;
    if (!Number.isNaN(secMonthsNum) && secMonthsNum >= 0) depositConfig.securityMonths = secMonthsNum;
    if (!Number.isNaN(advAmtNum) && advAmtNum >= 0) depositConfig.advanceAmount = advAmtNum;
    if (!Number.isNaN(secAmtNum) && secAmtNum >= 0) depositConfig.securityAmount = secAmtNum;
    const payload: any = { ...formData, amount: amountValue, status: activeTab };
    if (Object.keys(depositConfig).length) payload.depositConfig = depositConfig;
    
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = editingId ? `/api/sales/${editingId}` : "/api/sales";
      const method = editingId ? "PATCH" : "POST";
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort("timeout"), 30000);
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (res.ok) {
          mutateSales();
          if (editingId) {
            alert("Sales record updated successfully.");
          } else {
            alert("New Sale is successfully Save");
          }
          resetForm();
        }
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (err?.name === 'AbortError' || (err instanceof TypeError && (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("abort")))) {
          console.warn("Submit sale request aborted/timeout or network issue");
        } else {
          console.error("Submit sale error:", err);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e: any) {
      console.error("Submit outer error:", e);
    }
  };

  return (
    <div className="space-y-3 p-1">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-lg font-bold text-slate-800">Sales Records</h1>
        <button
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <Icons.Plus /> Add Sale
        </button>
      </div>

      {(salesError || listingsError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Failed to load data. Please try refreshing the page.
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 pt-1 rounded-t-xl mb-3">
        {STATUS_CATEGORIES.map((status) => {
          const count = mounted && sales ? sales.filter((s: any) => s.status === status).length : 0;
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => {
                setActiveTab(status);
                if (status === "In Progress" && count === 0) {
                  setSelectedSale(null);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold transition-all border-b-2 relative ${
                isActive 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {status}
              <span className={`px-1 rounded-md text-[9px] ${isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                {mounted ? count : "..."}
              </span>
            </button>
          );
        })}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-1">
          <div 
            style={{ 
              transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 relative"
          >
            <div 
              onMouseDown={handleMouseDown}
              className="px-3 py-1.5 border-b flex justify-between items-center bg-slate-50 cursor-move select-none"
            >
              <h2 className="text-sm font-bold text-slate-800 pointer-events-none">
                {editingId ? "Edit Sales Record" : "Add New Sale"}
              </h2>
              <button 
                onClick={resetForm}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors relative z-10"
              >
                <Icons.X />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="py-0 px-3 space-y-0">
                {/* Status Tabs */}
                <div className="flex border-b">
                  {STATUS_CATEGORIES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setActiveTab(status)}
                      className={`px-3 py-0.5 text-[9px] font-medium transition-colors border-b-2 ${
                        activeTab === status
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0 pt-0">
                  <div className="space-y-0">
                    <label className="text-[9px] font-medium text-slate-700 leading-none">Date</label>
                    <div className="date-input-container">
                      <input
                        type="date"
                        required
                        value={formData.saleDate}
                        onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                        className="w-full rounded border border-slate-300 bg-slate-100 py-0 text-[10px] text-black focus:ring-1 focus:ring-purple-500 outline-none h-[18px]"
                      />
                    </div>
                    <div className="space-y-0 mt-1">
                      <label className="text-[9px] font-medium text-slate-700 leading-none">Sales Category</label>
                      <select
                        value={formData.salesCategory}
                        onChange={(e) => setFormData({ ...formData, salesCategory: e.target.value })}
                        className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                      >
                        <option value="Sale">Sale</option>
                        <option value="Rental">Rental</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-0">
                    <label className="text-[9px] font-medium text-slate-700 leading-none">Property / Listing</label>
                    <select
                      value={formData.listingId}
                      onChange={(e) => setFormData({ ...formData, listingId: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                    >
                      <option value="">Select a property (optional)</option>
                      {listings.map((l: any) => (
                        <option key={l.id} value={l.id}>{l.title}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="space-y-0">
                        <label className="text-[9px] font-medium text-slate-700 leading-none">Room No</label>
                        <input
                          type="text"
                          value={formData.roomNo}
                          onChange={(e) => setFormData({ ...formData, roomNo: e.target.value })}
                          className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                          placeholder="Room No"
                        />
                      </div>
                      <div className="space-y-0">
                        <label className="text-[9px] font-medium text-slate-700 leading-none">Floor:</label>
                        <input
                          type="text"
                          value={formData.floor}
                          onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                          className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                          placeholder="Floor"
                        />
                      </div>
                    </div>
                  </div>

                  

                  {formData.salesCategory !== "Rental" && (
                    <div className="space-y-0">
                      <label className="text-[9px] font-medium text-slate-700 leading-none">Amount (Php)</label>
                      <CurrencyInput
                        required
                        value={formData.amount}
                        onChange={(val) => setFormData({ ...formData, amount: val })}
                        className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                        placeholder="0.00"
                      />
                    </div>
                  )}

                  
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setClientInfoOpen(v => !v)}
                      className="text-[10px] font-bold text-slate-800 mb-1 flex items-center justify-between w-full"
                      aria-expanded={clientInfoOpen}
                    >
                      <span>Client Information</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform text-blue-600 ${clientInfoOpen ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {clientInfoOpen && (
                      <div className="space-y-0">
                      <label className="text-[9px] font-medium text-slate-700 leading-none">Client Name</label>
                      <input
                        type="text"
                        required
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                        placeholder="Full name"
                      />
                    </div>
                    )}
                    {clientInfoOpen && (
                      <div className="space-y-0">
                      <label className="text-[9px] font-medium text-slate-700 leading-none">Address</label>
                      <input
                        type="text"
                        value={formData.clientAddress}
                        onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                        className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                        placeholder="Client's complete address"
                      />
                    </div>
                    )}
                    {clientInfoOpen && (
                      <div className="space-y-0">
                      <label className="text-[9px] font-medium text-slate-700 leading-none">Client Email</label>
                      <div className="relative">
                        <input
                          type="email"
                          value={formData.clientEmail}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                          placeholder="email@example.com"
                        />
                        {emailSuggestion && (
                          <div className="absolute left-0 top-full z-10 w-full bg-white border border-slate-200 shadow-lg rounded mt-0.5 p-0.5">
                            <p className="text-[8px] text-slate-500 mb-0">Did you mean?</p>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, clientEmail: emailSuggestion });
                                setEmailSuggestion(null);
                              }}
                              className="text-[9px] text-blue-600 hover:underline font-medium text-left w-full truncate"
                            >
                              {emailSuggestion}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                    {clientInfoOpen && (
                      <div className="space-y-0">
                      <label className="text-[9px] font-medium text-slate-700 leading-none">Messenger</label>
                      <input
                        type="text"
                        value={formData.clientMessenger}
                        onChange={(e) => setFormData({ ...formData, clientMessenger: e.target.value })}
                        className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                        placeholder="Messenger link or username"
                      />
                    </div>
                    )}
                    {clientInfoOpen && (
                      <div className="space-y-0">
                      <label className="text-[9px] font-medium text-slate-700 leading-none">Client Phone</label>
                      <input
                        type="text"
                        value={formData.clientPhone}
                        onChange={(e) => setFormData({ ...formData, clientPhone: formatPhone(e.target.value) })}
                        className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                        placeholder="09123456789"
                        maxLength={11}
                      />
                    </div>
                    )}
                  </div>
                  
                  {formData.salesCategory === "Rental" && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-800 mb-1">Contract</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-0">
                          <label className="text-[9px] font-medium text-slate-700 leading-none">Monthly Rent (Php)</label>
                          <CurrencyInput
                            required
                            value={formData.amount}
                            onChange={(val) => setFormData({ ...formData, amount: val })}
                            className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-0">
                          <label className="text-[9px] font-medium text-slate-700 leading-none">Date Started</label>
                          <div className="date-input-container">
                            <input
                              type="date"
                              value={formData.rentalStartDate}
                              onChange={(e) => setFormData({ ...formData, rentalStartDate: e.target.value })}
                              className="w-full rounded border border-slate-300 bg-slate-100 py-0 text-[10px] text-black focus:ring-1 focus:ring-purple-500 outline-none h-[18px]"
                            />
                          </div>
                        </div>
                        <div className="space-y-0">
                          <label className="text-[9px] font-medium text-slate-700 leading-none">Date Due</label>
                          <div className="date-input-container">
                            <input
                              type="date"
                              value={formData.rentalDueDate}
                              onChange={(e) => setFormData({ ...formData, rentalDueDate: e.target.value })}
                              className="w-full rounded border border-slate-300 bg-slate-100 py-0 text-[10px] text-black focus:ring-1 focus:ring-purple-500 outline-none h-[18px]"
                            />
                          </div>
                        </div>
                        <div className="space-y-0">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] text-slate-700 leading-none">Adv. Deposit Amount</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={formData.advanceDepositMonths}
                                onChange={(e) => setFormData({ ...formData, advanceDepositMonths: e.target.value })}
                                className="rounded border border-slate-300 bg-slate-100 px-1 py-0 text-[9px] text-black h-[18px] w-[46px]"
                                placeholder="0"
                                aria-label="Advance deposit months"
                                title="Number of months"
                              />
                              <span className="text-[9px] text-slate-500">mos</span>
                            </div>
                          </div>
                          <CurrencyInput
                            value={formData.advanceDeposit}
                            onChange={(val) => setFormData({ ...formData, advanceDeposit: val })}
                            className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-0">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] text-slate-700 leading-none">Sec. Deposit Amount</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={formData.securityDepositMonths}
                                onChange={(e) => setFormData({ ...formData, securityDepositMonths: e.target.value })}
                                className="rounded border border-slate-300 bg-slate-100 px-1 py-0 text-[9px] text-black h-[18px] w-[46px]"
                                placeholder="0"
                                aria-label="Security deposit months"
                                title="Number of months"
                              />
                              <span className="text-[9px] text-slate-500">mos</span>
                            </div>
                          </div>
                          <CurrencyInput
                            value={formData.securityDeposit}
                            onChange={(val) => setFormData({ ...formData, securityDeposit: val })}
                            className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none h-[18px]"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="md:col-span-2 space-y-0">
                    <label className="text-[9px] font-medium text-slate-700 leading-none">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] text-black focus:ring-1 focus:ring-blue-500 outline-none resize-none overflow-hidden"
                      placeholder="Additional details about the sale..."
                    />
                  </div>
                </div>
              </div>

              <div className="py-0 px-3 border-t bg-slate-50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-0 text-[8px] font-medium text-slate-700 hover:bg-slate-200 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-0 text-[8px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  {editingId ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Property</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Category</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!mounted || !sales ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                    {mounted ? "No sales records found." : "Loading..."}
                  </td>
                </tr>
              ) : (
                sales
                  .filter((s: any) => s.status === activeTab)
                  .map((sale: any) => (
                    <tr 
                      key={sale.id} 
                      onClick={() => setSelectedSale(sale)}
                      className={`hover:bg-blue-50/30 transition-colors cursor-pointer group ${selectedSale?.id === sale.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {mounted && sale.saleDate ? new Date(sale.saleDate).toLocaleDateString("en-PH", { year: 'numeric', month: 'short', day: 'numeric' }) : (mounted ? "N/A" : "...")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold text-slate-800">{sale.clientName}</div>
                        <div className="text-[10px] text-slate-500">{sale.clientPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {sale.listing?.title || "Custom Entry"}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-900 text-right">
                        {mounted ? `₱${Number(sale.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "₱..."}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          sale.salesCategory === "Rental" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
                        }`}>
                          {sale.salesCategory || "Sale"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center relative">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(sale); }}
                            className="p-1 rounded text-blue-600 hover:bg-blue-50"
                            aria-label="Edit"
                          >
                            <Icons.Pencil />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(sale.id); }}
                            className="p-1 rounded text-red-600 hover:bg-red-50"
                            aria-label="Delete"
                          >
                            <Icons.Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-6">
        <SalesRentalDetailCard sale={liveSale} />
      </div>
    </div>
  );
}
