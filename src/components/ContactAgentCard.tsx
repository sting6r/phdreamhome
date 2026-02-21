"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getProxyImageUrl } from "@/lib/image-utils";

interface Agent {
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: string | null;
  licenseNo: string | null;
  dhsudAccredNo: string | null;
  imageUrl?: string | null;
}

export default function ContactAgentCard({ 
  listingId, 
  listingTitle,
  agent 
}: { 
  listingId: string;
  listingTitle: string;
  agent: Agent;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: `I am interested in ${listingTitle}` });
  const [tourForm, setTourForm] = useState({ 
    name: "", 
    email: "", 
    phone: "", 
    date: "", 
    time: "09:00", 
    message: `I would like to schedule a tour for ${listingTitle}` 
  });

  useEffect(() => {
    if (mounted) {
      setTourForm(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0]
      }));
    }
  }, [mounted]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tourSent, setTourSent] = useState(false);
  const [tourSentMessage, setTourSentMessage] = useState("");
  const [tourError, setTourError] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [tourEmailSuggestion, setTourEmailSuggestion] = useState<string | null>(null);

  const autoCorrectPhone = (val: string) => {
    let clean = val.replace(/\D/g, "");
    if (clean.startsWith("63") && clean.length > 10) {
      clean = "0" + clean.slice(2);
    }
    return clean.slice(0, 11);
  };

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
    if (suggestion) {
      return `${local}@${suggestion}`;
    }
    return null;
  };

  const handleEmailChange = (val: string) => {
    setForm({ ...form, email: val });
    setEmailSuggestion(getEmailSuggestion(val));
  };

  const handleTourEmailChange = (val: string) => {
    setTourForm({ ...tourForm, email: val });
    setTourEmailSuggestion(getEmailSuggestion(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/mail-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          listingId,
          topic: form.subject || listingTitle,
          status: "Interested",
          type: "Listing"
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        setSentMessage(data.message || "Your inquiry has been sent! Our agent will contact you shortly.");
        setTimeout(() => setIsOpen(false), 3000);
      } else {
        setError(data.error || "Failed to send inquiry. Please try again.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError("Request timed out. Please try again.");
      } else {
        console.error(err);
        setError("A network error occurred. Please check your connection.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleTourSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTourError(null);
    const tourController = new AbortController();
    const tourTimeoutId = setTimeout(() => tourController.abort(), 30000);
    try {
      const res = await fetch("/api/mail-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...tourForm,
          listingId,
          topic: `Tour Request: ${listingTitle}`,
          type: "Tour",
          tourDate: tourForm.date,
          tourTime: tourForm.time,
          status: "Interested"
        }),
        signal: tourController.signal
      });
      clearTimeout(tourTimeoutId);
      const data = await res.json();
      if (res.ok) {
        setTourSent(true);
        const msg = data.message || "Thank you for scheduling a site viewing! Our team has received your request. Please stay tuned for a confirmation from one of our agents, who will reach out to you shortly to finalize the details.";
        setTourSentMessage(msg);
        window.alert(msg);
        setTimeout(() => {
          setIsTourOpen(false);
          setTourSent(false);
        }, 10000);
      } else {
        setTourError(data.error || "Failed to schedule tour. Please try again.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTourError("Request timed out. Please try again.");
      } else {
        console.error(err);
        setTourError("A network error occurred. Please check your connection.");
      }
    } finally {
      clearTimeout(tourTimeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    const adjustHeight = (el: HTMLTextAreaElement) => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    const textareas = document.querySelectorAll("textarea");
    textareas.forEach(el => adjustHeight(el as HTMLTextAreaElement));
  }, [form.message, tourForm.message, isOpen, isTourOpen]);

  return (
    <div className="card space-y-2 listing-sidebar">
      <div className="text-sm font-medium">Contact Agent</div>
      <button 
        className="btn-blue w-full"
        onClick={() => {
          setIsOpen(!isOpen);
          setIsTourOpen(false);
        }}
      >
        {isOpen ? "Close Inquiry" : "Request Info"}
      </button>
      <button 
        className="btn-blue w-full"
        onClick={() => {
          setIsTourOpen(!isTourOpen);
          setIsOpen(false);
        }}
      >
        {isTourOpen ? "Close Tour Schedule" : "Schedule Tour"}
      </button>
      
      {/* Request Info Form */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-[1000px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
        <div className="p-4 bg-[#F9F5FF] rounded-md border border-slate-200 shadow-sm space-y-4">
          {/* ... agent info ... */}
          <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 relative flex-shrink-0">
              {agent.imageUrl ? (
                <Image 
                  src={getProxyImageUrl(agent.imageUrl)} 
                  alt={agent.name || "Agent"} 
                  fill 
                  className="object-cover" 
                  onError={() => {
                    console.error("ContactAgentCard: Agent image failed to load:", agent.imageUrl);
                  }}
                />
              ) : (
                <div className="w-full h-full grid place-items-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-gray-500"><circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>
                </div>
              )}
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="text-sm font-semibold truncate">{agent.name || "Agent"}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{agent.role || "Real Estate Broker"}</div>
              {agent.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12 .88.33 1.74.62 2.56a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 7 7l.61-.28a2 2 0 0 1 2.11-.45c.82 .29 1.68 .5 2.56 .62A2 2 0 0 1 22 16.92z"/></svg>
                  <span className="truncate">{agent.phone}</span>
                </div>
              )}
              {agent.licenseNo && (
                <div className="text-[10px] text-slate-500 mt-1 truncate" title={agent.licenseNo}>License: {agent.licenseNo}</div>
              )}
              {agent.dhsudAccredNo && (
                <div className="text-[10px] text-slate-500 truncate" title={agent.dhsudAccredNo}>DHSUD: {agent.dhsudAccredNo}</div>
              )}
            </div>
          </div>

          <div className="text-sm font-semibold text-black">Inquiry Form</div>
          {sent ? (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200">
              {sentMessage}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              {error && (
                <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {error}
                </div>
              )}
              <input 
                className="input text-sm" 
                placeholder="Your Name" 
                required 
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
              />
              <div className="space-y-1">
                <input 
                  className="input text-sm" 
                  placeholder="Your Email" 
                  type="email" 
                  required 
                  value={form.email}
                  onChange={e => handleEmailChange(e.target.value)}
                />
                {emailSuggestion && (
                  <div className="text-[10px] text-blue-600 px-1">
                    Did you mean <button type="button" className="font-bold underline" onClick={() => { setForm({...form, email: emailSuggestion}); setEmailSuggestion(null); }}>{emailSuggestion}</button>?
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <input 
                  className="input text-sm" 
                  placeholder="Phone Number" 
                  value={form.phone}
                  onChange={e => setForm({...form, phone: autoCorrectPhone(e.target.value)})}
                />
                <div className="text-[10px] text-slate-500 px-1">Format: 09XXXXXXXXX</div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-black">Subject *</label>
                <select 
                  className="input text-sm" 
                  required
                  value={form.subject}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === "Tour/Site Viewing") {
                      setIsTourOpen(true);
                      setIsOpen(false);
                      setTourForm(prev => ({
                        ...prev,
                        name: form.name || prev.name,
                        email: form.email || prev.email,
                        phone: form.phone || prev.phone
                      }));
                    } else {
                      setForm({...form, subject: val});
                    }
                  }}
                >
                  <option value="">Select a topic</option>
                  <option>Tour/Site Viewing</option>
                  <option>Buying</option>
                  <option>Selling</option>
                  <option>Renting</option>
                  <option>General Inquiry</option>
                </select>
              </div>
              <textarea 
                className="input text-sm resize-none overflow-hidden" 
                placeholder="Message" 
                required
                value={form.message}
                onChange={e => setForm({...form, message: e.target.value})}
              />
              <button 
                type="submit" 
                className="btn-blue w-full text-sm"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Inquiry"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Schedule Tour Form */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isTourOpen ? "max-h-[1000px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
        <div className="p-4 bg-[#F0F9FF] rounded-md border border-sky-200 shadow-sm space-y-4">
          <div className="text-sm font-semibold text-black">Schedule Site Viewing</div>
          <form onSubmit={handleTourSubmit} className="space-y-3">
            {tourError && (
              <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {tourError}
              </div>
            )}
            {!tourSent && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Preferred Date</label>
                    <div className="date-input-container">
                      <input 
                        type="date" 
                        className="input text-sm" 
                        required 
                        value={tourForm.date}
                        onChange={e => setTourForm({...tourForm, date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Preferred Time</label>
                    <input 
                      type="time" 
                      className="input text-sm" 
                      required 
                      value={tourForm.time}
                      onChange={e => setTourForm({...tourForm, time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Your Details</label>
                  <input 
                    className="input text-sm" 
                    placeholder="Full Name" 
                    required 
                    value={tourForm.name}
                    onChange={e => setTourForm({...tourForm, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <input 
                    className="input text-sm" 
                    placeholder="Email Address" 
                    type="email" 
                    required 
                    value={tourForm.email}
                    onChange={e => handleTourEmailChange(e.target.value)}
                  />
                  {tourEmailSuggestion && (
                    <div className="text-[10px] text-blue-600 px-1">
                      Did you mean <button type="button" className="font-bold underline" onClick={() => { setTourForm({...tourForm, email: tourEmailSuggestion}); setTourEmailSuggestion(null); }}>{tourEmailSuggestion}</button>?
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <input 
                    className="input text-sm" 
                    placeholder="Phone Number" 
                    required
                    value={tourForm.phone}
                    onChange={e => setTourForm({...tourForm, phone: autoCorrectPhone(e.target.value)})}
                  />
                  <div className="text-[10px] text-slate-500 px-1">Format: 09XXXXXXXXX</div>
                </div>
                <textarea 
                  className="input text-sm h-20" 
                  placeholder="Additional notes..." 
                  value={tourForm.message}
                  onChange={e => setTourForm({...tourForm, message: e.target.value})}
                />
              </>
            )}
            
            <button 
              type="submit" 
              className={`btn-blue w-full text-sm ${tourSent ? "bg-green-600 hover:bg-green-700" : "bg-sky-600 hover:bg-sky-700"}`}
              disabled={loading || tourSent}
            >
              {loading ? "Scheduling..." : tourSent ? "Request Received" : "Confirm Tour Schedule"}
            </button>

            {tourSent && (
              <div className="mt-4 p-4 bg-white rounded-lg border-2 border-green-500 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 p-2 rounded-full flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-5 h-5 text-green-600">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-800 font-medium leading-relaxed">
                    {tourSentMessage}
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
