"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import InquiryActions from "./InquiryActions";
import TranscriptButton from "./TranscriptButton";

interface TourInquiry {
  id: string;
  createdAt: string | Date;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string | null;
  transcript?: any;
  type?: string | null;
  tourDate?: string | null;
  tourTime?: string | null;
  listing: {
    title: string;
    slug: string;
    address: string;
    city: string;
    state: string;
  } | null;
}

export default function TourInquiryCards({ inquiries }: { inquiries: any[] }) {
  const [expandedInquiries, setExpandedInquiries] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedInquiries(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    const clean = phone.replace(/\D/g, "");
    if (clean.length === 11) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  const getDisplayMessage = (inquiry: TourInquiry) => {
    if (inquiry.transcript) {
      try {
        let messages = inquiry.transcript;
        if (typeof messages === 'string') messages = JSON.parse(messages);
        if (messages && !Array.isArray(messages) && messages.messages) messages = messages.messages;
        if (Array.isArray(messages)) {
          const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
          if (lastUserMsg) return lastUserMsg.content;
        }
      } catch (e) {}
    }
    return inquiry.message;
  };

  if (inquiries.length === 0) return null;

  // Avoid hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="space-y-4 mb-10 opacity-50">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-slate-800">Tour / Site Viewing</h2>
          <p className="text-sm text-slate-500">Loading viewing requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-10">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold text-slate-800">Tour / Site Viewing</h2>
        <p className="text-sm text-slate-500">Viewing Request and Inquiries.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {inquiries.map((inquiry: TourInquiry) => (
          <div key={inquiry.id} className="card p-5 bg-white border border-slate-200 hover:shadow-md transition-shadow flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col gap-2">
                <div className="bg-purple-50 text-purple-700 text-[10px] font-bold uppercase px-2 py-1 rounded-full w-fit">
                  {inquiry.type === "Tour" && inquiry.subject?.includes("AI") ? "AI Tour Request" : "Tour Request"}
                </div>
                {inquiry.transcript && (
                  <TranscriptButton 
                    transcript={inquiry.transcript} 
                    clientName={inquiry.name} 
                    inquiryId={inquiry.id} 
                  />
                )}
              </div>
              <InquiryActions inquiryId={inquiry.id} currentStatus={inquiry.status} />
            </div>

            <div className="space-y-4 flex-grow">
              {/* Tour Schedule Section */}
              <div 
                className="p-3 bg-sky-50 rounded-lg border border-sky-100 flex justify-between items-center cursor-pointer hover:bg-sky-100/50 transition-colors"
                onClick={() => toggleExpand(inquiry.id)}
              >
                <div className="space-y-1 flex-grow">
                  <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Schedule for Tour</div>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-xs text-slate-500">Date</div>
                      <div className="font-semibold text-slate-900">{inquiry.tourDate || "Not set"}</div>
                    </div>
                    <div className="h-8 w-px bg-sky-200"></div>
                    <div>
                      <div className="text-xs text-slate-500">Time</div>
                      <div className="font-semibold text-slate-900">{inquiry.tourTime || "Not set"}</div>
                    </div>
                  </div>
                </div>
                <div className="ml-2">
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    className={`w-4 h-4 text-sky-500 transition-transform duration-300 ${expandedInquiries.includes(inquiry.id) ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Collapsible Content */}
              <div className={`space-y-4 overflow-hidden transition-all duration-300 ${expandedInquiries.includes(inquiry.id) ? "max-h-[500px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
                {/* Property Details */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Property Details</div>
                  {inquiry.listing ? (
                    <div className="space-y-1">
                      <Link 
                        href={`/listing/${inquiry.listing.slug}`} 
                        className="text-sm font-bold text-slate-900 hover:text-sky-600 transition-colors block"
                        target="_blank"
                      >
                        {inquiry.listing.title}
                      </Link>
                      <div className="text-xs text-slate-600 flex items-start gap-1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 mt-0.5 shrink-0 text-slate-400"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>{inquiry.listing.address}, {inquiry.listing.city}, {inquiry.listing.state}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 italic">Property no longer available</div>
                  )}
                </div>

                {/* Client Info */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client Information</div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-900">
                      <span className="text-slate-500 font-normal mr-1">Name:</span>
                      {inquiry.name}
                    </div>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="mr-1 text-slate-500">Email:</span>
                        <a href={`mailto:${inquiry.email}`} className="hover:text-sky-600 underline font-medium text-black">{inquiry.email}</a>
                      </div>
                      {inquiry.phone && (
                        <div>
                          <span className="mr-1 text-slate-500">Phone:</span>
                          <span className="font-medium text-black">{formatPhone(inquiry.phone)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message Section */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {inquiry.transcript ? "Latest Message (AI Chat)" : "Message"}
                  </div>
                  <p className="text-xs text-black line-clamp-3 italic leading-relaxed">
                    &quot;{getDisplayMessage(inquiry)}&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Message Sent Footer */}
            <div className="mt-6 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px]">
              <div className="text-slate-400">
                <span className="font-medium">Sent:</span> {!mounted ? "..." : new Date(inquiry.createdAt).toLocaleDateString()} @ {!mounted ? "..." : new Date(inquiry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className={`font-bold uppercase tracking-tighter ${
                inquiry.status === "Pending" ? "text-amber-500" :
                inquiry.status === "Contacted" ? "text-blue-500" :
                "text-green-500"
              }`}>
                {inquiry.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
