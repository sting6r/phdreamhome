"use client";
import MainFooterCards from "../../components/MainFooterCards";
import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

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

  const updateForm = (updates: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...updates }));
    setSent(null);
    setError(null);
  };

  const handleEmailChange = (val: string) => {
    updateForm({ email: val });
    setEmailSuggestion(getEmailSuggestion(val));
  };

  const autoCorrectPhone = (val: string) => {
    let clean = val.replace(/\D/g, "");
    if (clean.startsWith("63") && clean.length > 10) {
      clean = "0" + clean.slice(2);
    }
    return clean.slice(0, 11);
  };
  const mapUrl = "https://www.google.com/maps?q=10.3157,123.8854&hl=en&z=14&output=embed";
  const msgWordCount = (form.message || "").trim().split(/\s+/).filter(Boolean).length;
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(null);
    setLoading(true);
    try {
      if (!form.name || !form.email || !form.subject || !form.message) {
        setError("Please fill all required fields");
        setTimeout(() => setError(null), 5000);
        return;
      }

      const res = await fetch("/api/mail-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "Contact" }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to send message");
        setTimeout(() => setError(null), 5000);
      } else {
        setSent("Message sent successfully");
        setForm({ name: "", email: "", phone: "", subject: "", message: "" });
        setTimeout(() => setSent(null), 5000);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="container space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 text-slate-800 mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M3 7v13h18V7l-9-5-9 5z"/></svg>
              <div className="font-semibold">Our Office</div>
            </div>
            <div className="text-sm font-semibold">PhDreamHome</div>
            <div className="text-sm text-slate-700">Cebu City, Philippines</div>
            <div className="mt-3 space-y-2 text-sm text-slate-800">
              <div className="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.86 19.86 0 0 1 3.1 5.28 2 2 0 0 1 5 3.1h3a2 2 0 0 1 2 1.72 13 13 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9 11a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45 13 13 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="tel:+639772838819">+639772838819</a></div>
              <div className="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/></svg><a href="mailto:deladonesadlawan@gmail.com">deladonesadlawan@gmail.com</a></div>
              <div className="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M3 4h18M3 10h18M3 16h18"/></svg><span>Mon-Fri: 8AM-6PM, Sat: 10AM-4PM</span></div>
            </div>
          </div>
          <div className="card">
            <div className="font-semibold mb-3">Why Choose Us?</div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-slate-800"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M12 2l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-8.5L2 9h7z"/></svg><div><div className="font-medium">Expert Team</div><div className="text-slate-600">Experienced professionals with local market knowledge</div></div></div>
              <div className="flex items-start gap-3 text-sm text-slate-800"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M3 3h18v18H3z"/></svg><div><div className="font-medium">Premium Properties</div><div className="text-slate-600">Curated selection of high-quality properties</div></div></div>
              <div className="flex items-start gap-3 text-sm text-slate-800"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M3 12l5 5L21 4"/></svg><div><div className="font-medium">Proven Results</div><div className="text-slate-600">Track record of successful transactions</div></div></div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center gap-2 text-slate-800 mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-600"><path d="M21 15a2 2 0 0 1-2 2h-3l-4 4v-4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9z"/></svg>
              <div className="font-semibold">Send Us a Message</div>
            </div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" placeholder="Your full name" value={form.name} onChange={e=>updateForm({ name: e.target.value})} />
                  <div className="text-[10px] text-slate-500 px-1 mt-1">Please enter your first and last name.</div>
                </div>
                <div>
                  <label className="label">Email Address *</label>
                  <input 
                    type="email" 
                    className="input" 
                    placeholder="your@email.com" 
                    value={form.email} 
                    onChange={e => handleEmailChange(e.target.value)} 
                  />
                  <div className="text-[10px] text-slate-500 px-1 mt-1">We will use this to send you property details and updates.</div>
                  {emailSuggestion && (
                    <div className="text-[10px] text-blue-600 mt-1">
                      Did you mean <button type="button" className="font-bold underline" onClick={() => { setForm({...form, email: emailSuggestion}); setEmailSuggestion(null); }}>{emailSuggestion}</button>?
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input" placeholder="09XXXXXXXXX" value={form.phone} onChange={e=>updateForm({ phone: autoCorrectPhone(e.target.value)})} />
                  <div className="text-[10px] text-slate-500 px-1 mt-1">Format: 09XXXXXXXXX</div>
                </div>
                <div>
                  <label className="label">Subject *</label>
                  <select className="input" value={form.subject} onChange={e=>updateForm({ subject: e.target.value})}>
                    <option value="">Select a topic</option>
                    <option>Buying</option>
                    <option>Selling</option>
                    <option>Renting</option>
                    <option>General Inquiry</option>
                  </select>
                  <div className="text-[10px] text-slate-500 px-1 mt-1">Choose the topic that best describes your inquiry.</div>
                </div>
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea
                  className="input h-28"
                  placeholder="Tell us about your real estate needs, timeline, budget, or any specific questions you have..."
                  value={form.message}
                  onChange={e=>{
                    const v = e.target.value;
                    const ws = v.trim().split(/\s+/).filter(Boolean);
                    const msg = ws.length > 300 ? ws.slice(0, 300).join(" ") : v;
                    updateForm({ message: msg});
                  }}
                />
                <div className={msgWordCount >= 270 ? "text-xs text-red-600 text-right" : "text-xs text-slate-500 text-right"}>{msgWordCount}/300 words</div>
              </div>
              {error && <div className="text-red-600 text-sm cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setError(null)} title="Click to dismiss">{error}</div>}
              {sent && <div className="text-green-600 text-sm cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setSent(null)} title="Click to dismiss">{sent}</div>}
              <button type="submit" className="btn-blue w-full sm:w-auto" disabled={loading}>{loading ? "Sending..." : "Send Message"}</button>
            </form>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="relative w-full h-[22rem] rounded-md overflow-hidden">
          <iframe src={mapUrl} className="absolute inset-0 w-full h-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </div>
      <MainFooterCards />
    </div>
  );
}
