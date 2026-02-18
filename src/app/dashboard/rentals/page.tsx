"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { supabase } from "@lib/supabase";
import Link from "next/link";

const fetcher = async (u: string, { signal }: { signal?: AbortSignal } = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), 10000);

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
      console.warn("Rentals fetcher parse warning:", u, r.status);
      return null;
    }
  } catch (err: any) {
    if (isAbortError(err)) {
      return null;
    }
    const msg = String(err?.message || "").toLowerCase();
    if (err instanceof TypeError && (msg.includes("failed to fetch") || msg.includes("network"))) return null;
    console.warn("Rentals fetcher warning:", err?.message || err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const TABS = ["Active", "Ending Soon", "History", "Calendar"];

const Icons = {
  Home: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
  ),
  FileText: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
  ),
  AlertTriangle: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
  ),
  Peso: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 6h8a3 3 0 0 1 0 6H7" />
      <path d="M7 12h8a3 3 0 0 1 0 6H7" />
      <path d="M5 9h10" />
      <path d="M5 15h10" />
      <path d="M7 6v12" />
    </svg>
  )
};

export default function RentalsPage() {
  const swrCfg = { onError: (err: any) => { const msg = String(err?.message || ""); if (err?.name === "AbortError" || /abort/.test(msg)) return; } };
  const { data: salesData, error } = useSWR("/api/sales", fetcher, swrCfg);
  const [activeTab, setActiveTab] = useState("Active");
  const [mounted, setMounted] = useState(false);
  const [selectedRental, setSelectedRental] = useState<any>(null);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  // Filter rentals from sales records
  const allRentals = (salesData || []).filter((s: any) => s.salesCategory === "Rental");
  
  const activeRentals = allRentals.filter((r: any) => r.status === "In Progress");
  const historyRentals = allRentals.filter((r: any) => r.status === "Closed" || r.status === "Cancelled");
  
  // "Ending Soon" are active rentals with due date within 30 days
  const endingSoonRentals = activeRentals.filter((r: any) => {
    if (!r.rentalDueDate) return false;
    const dueDate = new Date(r.rentalDueDate);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  const getTabCount = (tab: string) => {
    switch (tab) {
      case "Active": return activeRentals.length;
      case "Ending Soon": return endingSoonRentals.length;
      case "History": return historyRentals.length;
      default: return 0;
    }
  };

  const renderStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      "In Progress": "bg-green-100 text-green-700 border-green-200",
      "Closed": "bg-slate-100 text-slate-700 border-slate-200",
      "Cancelled": "bg-red-100 text-red-700 border-red-200",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Detail Modal */}
      {selectedRental && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Rental Record Details</h2>
                <p className="text-sm text-slate-500">#{selectedRental.id.slice(-8)}</p>
              </div>
              <button onClick={() => setSelectedRental(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Client Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Icons.User /> Client Information
                </h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Full Name</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRental.clientName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Contact</p>
                      <p className="text-sm text-slate-700">{selectedRental.clientPhone || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Email</p>
                      <p className="text-sm text-slate-700 truncate">{selectedRental.clientEmail || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lease Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Icons.Clock /> Lease Terms
                </h3>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-blue-400 font-semibold uppercase">Start Date</p>
                      <p className="text-sm font-bold text-slate-900">{formatDate(selectedRental.rentalStartDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-orange-400 font-semibold uppercase">End Date</p>
                      <p className="text-sm font-bold text-slate-900">{formatDate(selectedRental.rentalDueDate)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Monthly Rent</p>
                    <p className="text-lg font-bold text-blue-600">₱{(selectedRental.amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Property Details */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Icons.Home /> Property Reference
                </h3>
                <div className="flex items-center gap-4 p-4 border rounded-xl hover:border-blue-200 transition-colors cursor-pointer">
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <Icons.Home />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{selectedRental.listing?.title || "Custom Property Record"}</p>
                    <p className="text-xs text-slate-500 truncate">{selectedRental.listing?.location || "Manila, Philippines"}</p>
                  </div>
                  <Icons.ChevronRight />
                </div>
              </div>

              {/* Notes */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Icons.FileText /> Contract Notes
                </h3>
                <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-xl">
                  <p className="text-sm text-slate-700 leading-relaxed italic">
                    {selectedRental.notes || "No additional notes for this contract."}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
              <button onClick={() => setSelectedRental(null)} className="px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Close
              </button>
              <button className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm shadow-blue-200">
                Update Contract
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rental Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track leases, contract durations, and client relations</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/sales" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-sm shadow-blue-200">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Rental
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-6 pt-2 rounded-t-xl">
        {TABS.map((tab) => {
          const count = getTabCount(tab);
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 relative ${
                isActive 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab === "Ending Soon" && endingSoonRentals.length > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-orange-500 absolute top-2 right-2 animate-pulse" />
              )}
              {tab}
              {tab !== "Calendar" && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-b-xl border border-slate-200 border-t-0 shadow-sm overflow-hidden">
        {activeTab === "Calendar" ? (
          <div className="p-12 text-center">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Calendar />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Calendar View</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2">Interactive calendar for tracking lease expirations and payment schedules is being synchronized.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Property & Client</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Lease Period</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status & Amount</th>
                  <th className="px-6 py-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Next Action</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeTab === "Active" ? activeRentals : activeTab === "Ending Soon" ? endingSoonRentals : historyRentals).map((rental: any) => (
                  <tr key={rental.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{rental.clientName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">#{rental.id.slice(-4)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Icons.Home />
                          <span className="truncate max-w-[200px]">{rental.listing?.title || "Custom Listing"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 italic">
                          <Icons.User />
                          <span>{rental.clientPhone || "No contact"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Started</span>
                            <span className="text-xs text-slate-700">{formatDate(rental.rentalStartDate)}</span>
                          </div>
                          <Icons.ChevronRight />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Expires</span>
                            <span className={`text-xs font-medium ${activeTab === "Ending Soon" ? "text-orange-600" : "text-slate-700"}`}>
                              {formatDate(rental.rentalDueDate)}
                            </span>
                          </div>
                        </div>
                        {rental.rentalDueDate && (
                          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${activeTab === "Ending Soon" ? "bg-orange-500" : "bg-blue-500"}`} 
                              style={{ width: '65%' }} 
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {renderStatusBadge(rental.status)}
                        <span className="text-sm font-bold text-slate-900">
                          ₱{(rental.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {activeTab === "Ending Soon" ? (
                        <div className="flex items-center gap-1.5 text-xs text-orange-600 font-medium bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                          <Icons.AlertTriangle />
                          Renewal Due
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          <Icons.Clock />
                          On Schedule
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedRental(rental)}
                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-slate-600"
                      >
                        <Icons.FileText />
                      </button>
                    </td>
                  </tr>
                ))}
                {(activeTab === "Active" ? activeRentals : activeTab === "Ending Soon" ? endingSoonRentals : historyRentals).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <p className="text-slate-400 text-sm">No rental records found for this category.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Corporate Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
            <Icons.Home />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Occupancy Rate</p>
            <p className="text-xl font-bold text-slate-900">92.4%</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-lg text-green-600">
            <Icons.Peso />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Monthly Revenue</p>
            <p className="text-xl font-bold text-slate-900">₱450,200</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-orange-50 p-3 rounded-lg text-orange-600">
            <Icons.Clock />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Renewals</p>
            <p className="text-xl font-bold text-slate-900">{endingSoonRentals.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
