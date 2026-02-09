"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InquiryActions({ inquiryId, currentStatus }: { inquiryId: string, currentStatus: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const deleteInquiry = async () => {
    if (!confirm("Are you sure you want to delete this inquiry?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="p-1 rounded-full hover:bg-slate-200 transition-colors focus:outline-none relative z-10"
        aria-label="Actions"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-slate-600">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="fixed sm:absolute right-4 sm:right-0 mt-2 w-48 rounded-md shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-[999] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1" role="menu" aria-orientation="vertical">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Change Status</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateStatus("Pending");
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 ${currentStatus === "Pending" ? "bg-amber-50 text-amber-800" : "text-slate-700"}`}
              disabled={loading}
            >
              Pending
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateStatus("Contacted");
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 ${currentStatus === "Contacted" ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}
              disabled={loading}
            >
              Contacted
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateStatus("Resolved");
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 ${currentStatus === "Resolved" ? "bg-green-50 text-green-800" : "text-slate-700"}`}
              disabled={loading}
            >
              Resolved
            </button>
            <div className="border-t border-slate-100 my-1"></div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteInquiry();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              disabled={loading}
            >
              Delete Inquiry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
