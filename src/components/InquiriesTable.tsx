"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InquiryActions from "./InquiryActions";
import TranscriptButton from "./TranscriptButton";

interface Inquiry {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  transcript?: any;
  status: string | null;
  recipientEmail?: string | null;
  type?: string | null;
  tourDate?: string | null;
  tourTime?: string | null;
  listing: {
    title: string;
    slug: string;
  } | null;
}

export default function InquiriesTable({ 
  inquiries, 
  type = "general" 
}: { 
  inquiries: Inquiry[];
  type?: "general" | "ai";
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.length === inquiries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(inquiries.map((inq) => inq.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const bulkDelete = async () => {
    if (!selectedIds.length || !confirm(`Are you sure you want to delete ${selectedIds.length} inquiries?`)) return;
    setLoading(true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/inquiries/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
        signal: controller.signal
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Bulk delete parse error:", text.slice(0, 200));
        data = { error: "Invalid server response" };
      }

      if (res.ok && !data.error) {
        setSelectedIds([]);
        router.refresh();
      } else {
        alert(`Error: ${data.error || "Failed to delete inquiries"}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert("Request timed out. Please try again.");
      } else {
        console.error(err);
        alert("Failed to delete inquiries. Please check your internet connection.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!selectedIds.length) return;
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/inquiries/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status }),
        signal: controller.signal
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Bulk update parse error:", text.slice(0, 200));
        data = { error: "Invalid server response" };
      }

      if (res.ok && !data.error) {
        setSelectedIds([]);
        router.refresh();
      } else {
        alert(`Error: ${data.error || "Failed to update inquiries"}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        alert("Request timed out. Please try again.");
      } else {
        console.error(err);
        alert("Failed to update inquiries. Please check your internet connection.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-sky-50 border border-sky-100 rounded-lg animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-sky-700">
            {selectedIds.length} items selected
          </span>
          <div className="h-4 w-px bg-sky-200" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkUpdateStatus("Contacted")}
              disabled={loading}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-50"
            >
              Mark Contacted
            </button>
            <button
              onClick={() => bulkUpdateStatus("Resolved")}
              disabled={loading}
              className="text-xs font-semibold text-green-600 hover:text-green-700 disabled:opacity-50"
            >
              Mark Resolved
            </button>
            <button
              onClick={bulkDelete}
              disabled={loading}
              className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="bg-slate-50 border-b text-slate-700">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={inquiries.length > 0 && selectedIds.length === inquiries.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                {type === "general" && <th className="px-4 py-3 font-semibold">Recipient Agent</th>}
                <th className="px-4 py-3 font-semibold">Subject / Property</th>
                <th className="px-4 py-3 font-semibold">Message</th>
                {type === "ai" && <th className="px-4 py-3 font-semibold text-center">Transcript</th>}
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inquiries.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                    No inquiries received yet.
                  </td>
                </tr>
              ) : (
                inquiries.map((inquiry) => (
                  <tr 
                    key={inquiry.id} 
                    className={`hover:bg-slate-50/80 transition-colors group ${
                      selectedIds.includes(inquiry.id) ? "bg-sky-50/30" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        checked={selectedIds.includes(inquiry.id)}
                        onChange={() => toggleSelect(inquiry.id)}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {!mounted ? "..." : new Date(inquiry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {!mounted ? "..." : new Date(inquiry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        inquiry.type === "Tour" ? "bg-purple-100 text-purple-700" : 
                        inquiry.type === "Contact" ? "bg-blue-100 text-blue-700" :
                        inquiry.type === "Listing" || inquiry.type === "For Sale" ? "bg-green-100 text-green-700" :
                        inquiry.type === "For Rent" ? "bg-amber-100 text-amber-700" :
                        inquiry.type === "Preselling" ? "bg-cyan-100 text-cyan-700" :
                        inquiry.type === "RFO" ? "bg-indigo-100 text-indigo-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {inquiry.type || "General"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{inquiry.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${inquiry.email}`} className="text-sky-600 hover:underline">
                        {inquiry.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {inquiry.phone || "—"}
                    </td>
                    {type === "general" && (
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {inquiry.recipientEmail || "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-xs">{inquiry.subject || (type === "ai" ? "AI Inquiry" : "General Inquiry")}</div>
                      {type === "general" && inquiry.type === "Tour" && inquiry.tourDate && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 uppercase">
                            Tour: {inquiry.tourDate} @ {inquiry.tourTime}
                          </span>
                        </div>
                      )}
                      {inquiry.listing && (
                        <Link
                          href={`/listing/${inquiry.listing.slug}`}
                          className="text-[10px] text-sky-600 hover:underline"
                          target="_blank"
                          prefetch={false}
                        >
                          View: {inquiry.listing.title}
                        </Link>
                      )}
                    </td>
                    <td 
                      className="px-4 py-3 max-w-xs cursor-pointer hover:bg-slate-100/50"
                      onClick={() => setSelectedInquiry(inquiry)}
                    >
                      <p className="line-clamp-2 text-slate-600 text-xs" title="Click to view full message">
                        {inquiry.message}
                      </p>
                      <div className="text-[10px] text-sky-500 mt-0.5 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to expand
                      </div>
                    </td>
                    {type === "ai" && (
                      <td className="px-4 py-3 text-center">
                        <TranscriptButton
                          transcript={inquiry.transcript}
                          clientName={inquiry.name}
                          inquiryId={inquiry.id}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        inquiry.status === "Pending" ? "bg-amber-100 text-amber-800" :
                        inquiry.status === "Contacted" ? "bg-blue-100 text-blue-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {inquiry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InquiryActions inquiryId={inquiry.id} currentStatus={inquiry.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={!!selectedInquiry} 
        onClose={() => setSelectedInquiry(null)}
        title="Inquiry Details"
      >
        {selectedInquiry && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Name</label>
                <p className="text-slate-900 font-medium">{selectedInquiry.name}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <p className="text-sky-600 font-medium">{selectedInquiry.email}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                <p className="text-slate-900 font-medium">{selectedInquiry.phone || "Not provided"}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Received</label>
                <p className="text-slate-900 font-medium">
                  {!mounted ? "..." : new Date(selectedInquiry.createdAt).toLocaleDateString()} @ {!mounted ? "..." : new Date(selectedInquiry.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Classification</label>
                <p className="text-slate-900 font-medium">{selectedInquiry.type || "General Inquiry"}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Message</label>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedInquiry.message}
              </p>
            </div>

            {selectedInquiry.listing && (
              <div className="p-4 bg-sky-50 rounded-lg border border-sky-100">
                <label className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-2">Inquired Property</label>
                <Link 
                  href={`/listing/${selectedInquiry.listing.slug}`}
                  className="text-sky-700 font-bold hover:underline flex items-center gap-2"
                  target="_blank"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {selectedInquiry.listing.title}
                </Link>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Modal({ isOpen, onClose, children, title }: { isOpen: boolean, onClose: () => void, children: React.ReactNode, title: string }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
