"use client";

import { useState } from "react";
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
  const router = useRouter();

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
    try {
      const res = await fetch("/api/inquiries/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!selectedIds.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/inquiries/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      if (res.ok) {
        setSelectedIds([]);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
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
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
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
                      {new Date(inquiry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {new Date(inquiry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    <td className="px-4 py-3 max-w-xs">
                      <p className="line-clamp-2 text-slate-600 text-xs" title={inquiry.message}>
                        {inquiry.message}
                      </p>
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
    </div>
  );
}
