"use client";

import React, { useState } from "react";
import Link from "next/link";

type Status = "for-sale" | "for-rent" | "preselling" | "rfo";

interface QuickLinksSelectorProps {
  initialStatus?: Status;
}

export default function QuickLinksSelector({ initialStatus = "for-sale" }: QuickLinksSelectorProps) {
  const [selectedStatus, setSelectedStatus] = useState<Status>(initialStatus);

  const statusLabels: Record<Status, string> = {
    "for-sale": "For Sale",
    "for-rent": "For Rent",
    "preselling": "Preselling",
    "rfo": "RFO",
  };

  const categories = [
    { label: "Condominium", type: "Condominium" },
    { label: "House and Lot", type: "House and Lot" },
    { label: "Townhouse", type: "Town House" },
    { label: "Beach Property", type: "Beach Property" },
    { label: "Lot", type: "Lot Only" },
    { label: "Commercial Property", type: "Commercial Space" },
    { label: "Industrial Property", type: "Industrial Properties" },
  ];

  return (
    <div className="card shadow-md">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">QUICK LINKS</div>
      <div className="flex items-center border border-slate-200 rounded-md overflow-hidden mb-4">
        {(Object.keys(statusLabels) as Status[]).map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`flex-1 px-2 py-2 text-sm font-semibold text-center border-r border-slate-200 last:border-0 transition-colors ${
              selectedStatus === status
                ? "bg-[#DE6A4A] text-white"
                : "bg-white text-[#223B55] hover:bg-slate-50"
            }`}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <div className="text-sm font-semibold">Property Category for {statusLabels[selectedStatus]}</div>
      </div>

      <div className="mt-2 space-y-1 text-sm text-black">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span>Property Type</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        
        {categories.map((cat) => (
          <div key={cat.type} className="flex items-center justify-between group">
            <Link
              prefetch={false}
              href={`/properties/${selectedStatus}?type=${encodeURIComponent(cat.type)}`}
              className="block flex-1 hover:text-[#DE6A4A] transition-colors"
            >
              {cat.label}
            </Link>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-500 group-hover:text-[#DE6A4A] transition-colors">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
