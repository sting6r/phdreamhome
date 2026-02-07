"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat, type UIMessage as Message } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Script from "next/script";
import { X, Send, User, Minimize2, Maximize2, Loader2, ExternalLink, Image as ImageIcon, ChevronLeft, Undo2, GripHorizontal } from "lucide-react";
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase";

export default function AIAgent() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, [pathname]);

  const [isMinimized, setIsMinimized] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showInChatQuickActions, setShowInChatQuickActions] = useState(false);
  const [suppressQuickActions, setSuppressQuickActions] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [currentInquiryId, setCurrentInquiryId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [propertyFormMode, setPropertyFormMode] = useState<'rent' | 'sell'>('rent');
  const [chatSessions, setChatSessions] = useState<{ id: string; messages: Message[]; startedAt: number }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const defaultQuickActions = ["Inquire A Property", "Property Visit", "Sell your Property", "Rent out your Property"];
  const [quickActionList, setQuickActionList] = useState<string[]>(defaultQuickActions);
  const [inquireFilterStatus, setInquireFilterStatus] = useState<string | null>(null);
  const [inquireAwaitingCity, setInquireAwaitingCity] = useState(false);
  const [inquireSelectedCity, setInquireSelectedCity] = useState<string | null>(null);
  const [inquireMaxPrice, setInquireMaxPrice] = useState<number | null>(null);
  const [inquireBedrooms, setInquireBedrooms] = useState<number | null>(null);
  const [providerInfo, setProviderInfo] = useState<{ provider: string; model: string } | null>(null);
  const [propertyFormData, setPropertyFormData] = useState({
    location: "",
    type: "House and Lot",
    price: "",
    amenities: "",
    notes: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const inquiryIdRef = useRef<string | null>(null);
  const propertyFormJustSubmittedRef = useRef<boolean>(false);
  const syncAbortControllerRef = useRef<AbortController | null>(null);

  // Sync state to ref
  useEffect(() => {
    inquiryIdRef.current = currentInquiryId;
  }, [currentInquiryId]);
  
  const chatTransport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: {
        sessionId: currentSessionId || currentInquiryId || "default_session"
      }
    });
  }, [currentSessionId, currentInquiryId]);

  const chatInstance = useChat({
    id: "ai-agent-chat",
    transport: chatTransport,
    onError: (error) => {
      console.error("AI Chat Error (useChat onError):", error);
      let errorMessage = "An error occurred with the AI chat. Please try again.";
      if (error) {
        if (typeof error === 'string') {
          errorMessage += `\nError: ${error}`;
        } else if (error.message) {
          try {
            const rawMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
            const parsed = JSON.parse(rawMessage);
            errorMessage += `\nError: ${parsed.error || parsed.message || rawMessage}`;
          } catch {
            errorMessage += `\nError: ${error.message}`;
          }
        } else {
          errorMessage += `\nError: ${JSON.stringify(error)}`;
        }
      }
      alert(errorMessage);
    },
    onFinish: ({ message }) => {
      console.log("AI Chat Finished:", message);
      if (propertyFormJustSubmittedRef.current) {
        const closingMsg = {
          id: 'closing-' + Date.now(),
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, text: "Thank you for the details! Is there anything else I can help you with?" }]
        };
        chatInstance.setMessages((msgs) => [...msgs, closingMsg]);
        propertyFormJustSubmittedRef.current = false;
        const newAll = [...messagesRef.current, closingMsg];
        if (inquiryIdRef.current) {
          syncTranscriptToDb(newAll, inquiryIdRef.current);
        }
      }
    }
  });

  useEffect(() => {
    const status = (chatInstance as any).status;
    console.log("DEBUG: chatInstance full keys:", Object.keys(chatInstance));
    console.log("DEBUG: useChat available methods:", { 
      hasSendMessage: typeof (chatInstance as any).sendMessage === 'function',
      hasReload: typeof (chatInstance as any).reload === 'function',
      hasRegenerate: typeof (chatInstance as any).regenerate === 'function',
      status: status
    });
  }, [chatInstance]);
  
  const aiLoading = chatInstance.status === 'submitted' || chatInstance.status === 'streaming';

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = chatInstance.messages;
  }, [chatInstance.messages]);

  const sanitizeMessages = (msgs: any[]) => {
    if (!Array.isArray(msgs)) return msgs;
    return msgs.map((m) => {
      if (!m || typeof m !== "object") return m;
      const content = typeof m.content === "string"
        ? m.content
        : Array.isArray(m.parts)
          ? m.parts.filter((p: any) => p?.type === "text" && typeof p.text === "string").map((p: any) => p.text).join("\n")
          : "";
      const parts = Array.isArray(m.parts)
        ? m.parts
        : content
          ? [{ type: "text", text: content }]
          : [];
      return { ...m, content, parts };
    });
  };

  const extractWebsiteContext = async (signal?: AbortSignal) => {
    try {
      const title = typeof document !== 'undefined' ? (document.title || "") : "";
      const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="description"]') : null;
      const description = meta?.getAttribute('content') || "";
      const hs = typeof document !== 'undefined' ? Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 6).map((el: any) => String(el?.textContent || "").trim()).filter(Boolean) : [];
      const mainEl = typeof document !== 'undefined' ? (document.querySelector('main') || document.body) : null;
      const mainText = String((mainEl as any)?.innerText || "").replace(/\s+/g, ' ').trim().slice(0, 1200);
      const pathname = typeof window !== 'undefined' ? window.location.pathname : "";
      let listingsSnippet = "";
      try {
        const res = await fetch('/api/public-listings?featured=true', { 
          cache: 'no-store',
          signal 
        });
        const data = await res.json().catch(() => ({}));
        const listings = Array.isArray((data as any)?.listings) ? (data as any).listings : [];
        const safeListings = Array.isArray(listings) ? listings : [];
      const top = safeListings.slice(0, 3);
        if (top.length) {
          const lines = top.map((l: any, i: number) => {
            const price = typeof l?.price === 'number' ? `₱${Number(l.price).toLocaleString('en-PH')}` : '';
            const link = l?.slug ? `/listing/${l.slug}` : `/listing/${l?.id}`;
            const img = l?.images?.[0]?.url ? `![${l.title}](${l.images[0].url})\n` : '';
            const loc = [l?.city].filter(Boolean).join(', ');
            return `${img}${i + 1}. ${String(l?.title || '')}${price ? ` — ${price}` : ''}${loc ? ` • ${loc}` : ''}\nView: ${link}`;
          }).join('\n\n');
          listingsSnippet = lines;
        }
      } catch (e: any) {
        if (e.name === 'AbortError') throw e;
      }
      const parts = [
        title ? `Title: ${title}` : "",
        description ? `Description: ${description}` : "",
        pathname ? `Path: ${pathname}` : "",
        hs.length ? `Headings: ${hs.join(' • ')}` : "",
        mainText ? `Page Text: ${mainText}` : "",
        listingsSnippet ? `Featured Listings:\n\n${listingsSnippet}` : ""
      ].filter(Boolean).join('\n');
      if (!parts) return "";
      return `Website Context:\n${parts}`;
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      return "";
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/chat", { 
          method: "GET", 
          cache: "no-store",
          signal: controller.signal 
        });
        const data = await res.json().catch(() => ({}));
        if (data && (data.provider || data.model)) {
          setProviderInfo({ provider: String(data.provider || ""), model: String(data.model || "") });
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;
    setChatSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === currentSessionId);
      if (idx < 0) return prev;
      const firstTs = chatInstance.messages.length
        ? parseInt(String((chatInstance.messages[0] as any)?.id).match(/(\d{13})/)?.[1] || String(Date.now()), 10)
        : Date.now();
      const next = [...prev];
      next[idx] = { id: currentSessionId, messages: chatInstance.messages, startedAt: firstTs };
      sessionStorage.setItem("ai_agent_sessions", JSON.stringify(next));
      return next;
    });
  }, [chatInstance.messages, currentSessionId]);
  const safeJson = async (res: Response) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      return null;
    }
  };

  const syncTranscriptToDb = useCallback(async (msgs: Message[], id?: string | null) => {
    const targetId = id || inquiryIdRef.current;
    if (!targetId || targetId === "undefined" || targetId === "null" || msgs.length === 0) {
      console.log("Sync skipped: invalid id or no messages", { targetId, msgCount: msgs.length });
      return;
    }
    
    // Abort any pending sync request
    if (syncAbortControllerRef.current) {
      syncAbortControllerRef.current.abort();
    }
    syncAbortControllerRef.current = new AbortController();
    const signal = syncAbortControllerRef.current.signal;
    
    try {
      console.log(`Syncing ${msgs.length} messages to inquiry ${targetId}`);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const cleaned = sanitizeMessages(msgs as any[]);
      const res = await fetch(`${origin}/api/inquiries/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: cleaned }),
        signal,
      });
      if (!res.ok) {
        const errData = await safeJson(res);
        console.error("Sync failed server-side:", errData);
        
        // If record not found, clear the local inquiry ID to prevent further failures
        if (errData?.error?.includes("Record to update not found")) {
          console.warn("Inquiry record not found in DB, clearing local ID");
          setCurrentInquiryId(null);
          sessionStorage.removeItem("ai_agent_inquiry_id");
        }
      } else {
        console.log("Sync successful");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log("Sync aborted (superseded by a new request)");
        return;
      }
      
      console.warn("Error syncing transcript:", error);
      try {
        const unsynced = { id: targetId, messages: sanitizeMessages(msgs as any[]), ts: Date.now() };
        const prev = sessionStorage.getItem("ai_agent_unsynced");
        const list = prev ? JSON.parse(prev) : [];
        list.push(unsynced);
        sessionStorage.setItem("ai_agent_unsynced", JSON.stringify(list));
      } catch {}
      try {
        setTimeout(() => {
          try { syncTranscriptToDb(msgs, targetId); } catch {}
        }, 5000);
      } catch {}
    } finally {
      if (syncAbortControllerRef.current?.signal === signal) {
        syncAbortControllerRef.current = null;
      }
    }
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const sig = controller.signal;
    const fetchProfileAndHistory = async () => {
      // 1. Try to get from sessionStorage first
      const saved = sessionStorage.getItem("ai_agent_form_submitted");
      const savedId = sessionStorage.getItem("ai_agent_inquiry_id");
      const savedMessages = sessionStorage.getItem("ai_agent_messages");
      
      if (saved === "true" && savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          // Only update if messages are actually different to prevent infinite loops
          if (JSON.stringify(parsed) !== JSON.stringify(chatInstance.messages)) {
            chatInstance.setMessages(parsed);
          }
          setIsFormSubmitted(true);
          if (savedId && savedId !== "undefined" && savedId !== "null" && savedId !== currentInquiryId) {
            setCurrentInquiryId(savedId);
          }
          return;
        } catch (e) {
          console.error("Error parsing saved messages:", e);
        }
      }

      // 2. If not in session, try to get from profile if logged in
      try {
        const res = await fetch("/api/profile", { 
          signal: sig, 
          cache: "no-store",
          headers: { "Accept": "application/json" }
        });
        if (res.ok) {
          const profile = await safeJson(res);
          if (profile && profile.name && profile.email) {
            setFormData(prev => {
              if (prev.name === profile.name && prev.email === profile.email) return prev;
              return {
                name: profile.name,
                email: profile.email,
                phone: profile.phone || ""
              };
            });
            
            // Auto-check for existing history for this logged-in user
            const leadRes = await fetch("/api/leads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: sig,
              body: JSON.stringify({ 
                name: profile.name, 
                email: profile.email, 
                phone: profile.phone || "" 
              }),
            });

            if (leadRes.ok) {
              const data = await safeJson(leadRes);
              if (data) {
                const transcript = data.inquiry?.transcript;
                if (data.inquiry?.id !== currentInquiryId) {
                  setCurrentInquiryId(data.inquiry?.id);
                }
                setIsFormSubmitted(true);
                sessionStorage.setItem("ai_agent_form_submitted", "true");
                if (data.inquiry?.id) sessionStorage.setItem("ai_agent_inquiry_id", data.inquiry.id);

                if (data.alreadyExists && transcript) {
                  let parsedMessages = [];
                  if (typeof transcript === 'string') {
                    parsedMessages = JSON.parse(transcript);
                  } else if (Array.isArray(transcript)) {
                    parsedMessages = transcript;
                  } else if (transcript && typeof transcript === 'object' && (transcript as any).messages) {
                    parsedMessages = (transcript as any).messages;
                  }
                  
                  if (parsedMessages.length > 0) {
                    const cleaned = sanitizeMessages(parsedMessages as any[]);
                    if (JSON.stringify(cleaned) !== JSON.stringify(chatInstance.messages)) {
                      chatInstance.setMessages(cleaned as any);
                    }
                    sessionStorage.setItem("ai_agent_messages", JSON.stringify(parsedMessages));
                    return;
                  }
                }
                
                // If no history found, trigger greeting
                const greeting = {
                  id: 'greeting-' + Date.now(),
                  role: 'assistant' as const,
                  content: "👋 Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.",
                  parts: [{ type: 'text' as const, text: "👋 Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today." }]
                };
                if (chatInstance.messages.length === 0) {
                  chatInstance.setMessages([greeting]);
                }

                // Immediate sync for the greeting
                if (data.inquiry?.id) {
                  syncTranscriptToDb([greeting], data.inquiry.id);
                }
              }
            }
          }
        } else if (res.status === 401) {
           // Silently skip if unauthorized
        } else {
           console.warn(`AIAgent: Profile fetch failed with status ${res.status}`);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        if (e.message === 'Failed to fetch') return; // Ignore transient network errors
        console.error("AIAgent: Profile fetch error:", e);
      }
    };

    fetchProfileAndHistory();
    return () => {
      try { controller.abort(); } catch {}
    };
  }, [syncTranscriptToDb, currentInquiryId, chatInstance]);
  
  useEffect(() => {
    try {
      const savedSessions = sessionStorage.getItem("ai_agent_sessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const fixed = parsed.map((s: any) => {
            let id = String(s?.id || makeSessionId());
            if (seen.has(id)) {
              id = makeSessionId();
            }
            seen.add(id);
            return { ...s, id };
          });
          setChatSessions(fixed);
          sessionStorage.setItem("ai_agent_sessions", JSON.stringify(fixed));
        }
      }
    } catch {}
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.phone) {
      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const data = await safeJson(response);
          if (data) {
            const inquiryId = data.inquiry?.id || null;
            const transcript = data.inquiry?.transcript;
            
            setCurrentInquiryId(inquiryId);
            setIsFormSubmitted(true);
            sessionStorage.setItem("ai_agent_form_submitted", "true");
            if (inquiryId) sessionStorage.setItem("ai_agent_inquiry_id", inquiryId);

            if (data.alreadyExists && transcript) {
              // Load existing transcript
              try {
                let parsedMessages = [];
                if (typeof transcript === 'string') {
                  parsedMessages = JSON.parse(transcript);
                } else if (Array.isArray(transcript)) {
                  parsedMessages = transcript;
                } else if (transcript && typeof transcript === 'object' && (transcript as any).messages) {
                  parsedMessages = (transcript as any).messages;
                }
                
                if (parsedMessages.length > 0) {
                  chatInstance.setMessages(parsedMessages);
                  sessionStorage.setItem("ai_agent_messages", JSON.stringify(parsedMessages));
                  return; // Don't trigger greeting if we have history
                }
              } catch (e) {
                console.error("Error parsing existing transcript:", e);
              }
            }

            // Automatically trigger the greeting message if no history
            const greeting = {
              id: 'greeting-' + Date.now(),
              role: 'assistant' as const,
              content: "👋 Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.",
              parts: [{ type: 'text' as const, text: "👋 Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today." }]
            };
            chatInstance.setMessages([greeting]);
            
            // Immediate sync for the greeting
            if (inquiryId) {
              syncTranscriptToDb([greeting], inquiryId);
            }
          }
        } else {
          const errData = await safeJson(response);
          console.error("Failed to save lead:", errData);
          setIsFormSubmitted(true);
        }
      } catch (error) {
        console.error("Error submitting lead form:", error);
        setIsFormSubmitted(true);
      }
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && isFormSubmitted) {
      setShowChatHistory(true);
    }
  }, [isOpen, isFormSubmitted]);

  useEffect(() => {
    // Update initialMessages when messages change and persist to sessionStorage
    if (chatInstance.messages.length > 0) {
      sessionStorage.setItem("ai_agent_messages", JSON.stringify(chatInstance.messages));
    }
  }, [chatInstance.messages]);

  const getMessageText = (m: Message) => {
    if ((m as any).parts && Array.isArray((m as any).parts)) {
      return (m as any).parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('');
    }
    return (m as any).content || "";
  };
  const getMessageDate = (m: Message) => {
    const s = String((m as any).id || "");
    const match = s.match(/(\d{13})/);
    const t = match ? parseInt(match[1], 10) : Date.now();
    return new Date(t);
  };
  const formatDate = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const formatTime = (d: Date) => d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const makeSessionId = () => {
    try {
      const rnd = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      return `session-${rnd}`;
    } catch {
      return `session-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    }
  };

  const RenderText = ({ text }: { text: string }) => {
    return (
      <>
        {text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g).map((part, index) => {
          // Handle Images and Videos using ![alt](url)
          const imageMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
          if (imageMatch) {
            const alt = imageMatch[1];
            const url = imageMatch[2];
            const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/i) || url.includes('/videos/');
            
            return (
              <div key={index} className="my-2 rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-black/5">
                {isVideo ? (
                  <video src={url} controls preload="metadata" className="w-full h-auto max-h-64" />
                ) : (
                  <Image 
                    src={url} 
                    alt={alt} 
                    width={400}
                    height={300}
                    unoptimized
                    className="w-full h-auto object-cover max-h-64"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {alt && <div className="p-2 text-[10px] text-slate-500 bg-white/80 border-t border-slate-100">{alt}</div>}
              </div>
            );
          }

          // Handle Links [text](url)
          const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
          if (linkMatch && !part.startsWith('!')) {
            const linkText = linkMatch[1];
            const linkUrl = linkMatch[2];
            const isVideo = linkUrl.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/i) || linkUrl.includes('/videos/');

            if (isVideo) {
              return (
                <div key={index} className="my-2 rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-black/5">
                  <video src={linkUrl} controls preload="metadata" className="w-full h-auto max-h-64" />
                  {linkText && <div className="p-2 text-[10px] text-slate-500 bg-white/80 border-t border-slate-100">{linkText} (Video)</div>}
                </div>
              );
            }

            return (
              <Link 
                key={index}
                href={linkUrl}
                target={linkUrl.startsWith('http') ? "_blank" : "_self"}
                className="text-purple-600 font-bold underline hover:text-purple-800 transition-colors"
              >
                {linkText}
              </Link>
            );
          }
          
          if (part.includes('fill out a quick form:')) {
            return (
              <span key={index} className="block mt-3">
                {part}
                <button
                  onClick={() => setShowPropertyForm(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-purple-700 transition-all active:scale-95"
                >
                  <Image src="/girl.png" alt="AI" width={18} height={18} className="rounded-full" />
                  Fill Out Property Form
                </button>
              </span>
            );
          }

          if (part.includes('/contact')) {
            const linkLabel = part.toLowerCase().includes('tour') || part.toLowerCase().includes('visit') ? 'Schedule a Tour' : 'Contact Form';
            return (
              <span key={index}>
                {part.split('/contact')[0]}
                <Link 
                  href="/contact" 
                  className="inline-flex items-center gap-1 text-purple-600 font-bold underline hover:text-purple-800 transition-colors bg-purple-50 px-2 py-1 rounded"
                >
                  {linkLabel}
                </Link>
                {part.split('/contact')[1]}
              </span>
            );
          }
          
          if (part.includes('/listing/')) {
            const match = part.match(/\/listing\/[^\s]+/);
            const url = match ? match[0] : null;
            if (url) {
              const [before, after] = part.split(url);
              return (
                <span key={index}>
                  {before}
                  <Link 
                    href={url} 
                    prefetch={false}
                    className="inline-flex items-center gap-1 bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold hover:bg-purple-700 transition-colors shadow-sm"
                  >
                    View Listing
                  </Link>
                  {after}
                </span>
              );
            }
          }
          
          if (part.includes('/properties/')) {
            const match = part.match(/\/properties\/[^\s]+/);
            const url = match ? match[0] : null;
            if (url) {
              const [before, after] = part.split(url);
              return (
                <span key={index}>
                  {before}
                  <Link 
                    href={url} 
                    prefetch={false}
                    className="inline-flex items-center gap-1 bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold hover:bg-purple-700 transition-colors shadow-sm"
                  >
                    Open Properties Page
                  </Link>
                  {after}
                </span>
              );
            }
          }
          
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  const isLoading = aiLoading || (chatInstance.status as string) === "streaming";

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    setSuppressQuickActions(true);
    setShowInChatQuickActions(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name, file.size);
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleQuickAction = async (text: string) => {
    console.log("Quick action clicked:", text);
    if (isLoading) {
      console.log("Quick action blocked: isLoading is true");
      return;
    }

    if (text === "Property Visit" || text === "Visit a Property Today") {
      // Add user message and then a specific assistant response with the link
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      const assistantMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant' as const, 
        content: "I'd be happy to help you schedule a property visit! 🏠\n\nYou can schedule a tour by clicking the link below:\n\n/contact\n\nAlternatively, tell me which property you're interested in, and I can help you coordinate with an agent directly.",
        parts: [{ 
          type: 'text' as const, 
          text: "I'd be happy to help you schedule a property visit! 🏠\n\nYou can schedule a tour by clicking the link below:\n\n/contact\n\nAlternatively, tell me which property you're interested in, and I can help you coordinate with an agent directly." 
        }]
      };
      
      const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
      chatInstance.setMessages(newMsgs);
      if (currentInquiryId) {
        syncTranscriptToDb(newMsgs, currentInquiryId);
      }
      return;
    }

    if (text === "Inquire A Property") {
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      const assistantText = "Would you like to narrow the search by status or city? Please choose a status below or type a city (e.g., Cebu, Quezon City).";
      const assistantMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant' as const, 
        content: assistantText,
        parts: [{ type: 'text' as const, text: assistantText }]
      };
      const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
      chatInstance.setMessages(newMsgs);
      if (currentInquiryId) {
        syncTranscriptToDb(newMsgs, currentInquiryId);
      }
      setQuickActionList(["For Sale", "For Rent", "Preselling", "RFO", "All"]);
      setShowInChatQuickActions(true);
      setInquireAwaitingCity(true);
      setInquireFilterStatus(null);
      setInquireSelectedCity(null);
      setInquireMaxPrice(null);
      setInquireBedrooms(null);
      return;
    }

    if (text === "For Sale" || text === "For Rent" || text === "Preselling" || text === "RFO" || text === "All") {
      const selected = text === "All" ? null : text;
      setInquireFilterStatus(selected);
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      try {
        const qs = new URLSearchParams();
        if (selected) qs.set("status", selected);
        if (inquireSelectedCity) qs.set("city", inquireSelectedCity);
        if (inquireMaxPrice != null) qs.set("maxPrice", String(inquireMaxPrice));
        if (inquireBedrooms != null) qs.set("bedrooms", String(inquireBedrooms));
        const res = await fetch(`/api/public-listings?${qs.toString()}`, { cache: "no-store" });
        const data = await safeJson(res);
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        if (samples.length === 0) {
          const assistantText = "No properties were found for that status. You can type a city to refine, or choose a different status.";
          const assistantMsg = { 
            id: (Date.now() + 1).toString(), 
            role: 'assistant' as const, 
            content: assistantText,
            parts: [{ type: 'text' as const, text: assistantText }]
          };
          const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
          chatInstance.setMessages(newMsgs);
          if (currentInquiryId) {
            syncTranscriptToDb(newMsgs, currentInquiryId);
          }
          setQuickActionList(defaultQuickActions);
          setShowInChatQuickActions(true);
          setInquireAwaitingCity(true);
          return;
        }
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const build = samples.map((l: any, idx: number) => {
          const price = `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          const loc = makeLoc(l);
          const beds = Number(l.bedrooms) > 0 ? `${l.bedrooms} BR` : "";
          const baths = Number(l.bathrooms) > 0 ? `${l.bathrooms} BA` : "";
          const type = l.type ? `${l.type}` : "";
          const statusText = l.status ? `${l.status}` : "";
          const img = (Array.isArray(l.images) && l.images[0]?.url) ? `![${l.title} — ${price}](${l.images[0].url})\n` : "";
          const link = l.slug ? `/listing/${l.slug}` : `/listing/${l.id}`;
          const lines = [
            `${idx + 1}. ${l.title}`,
            loc ? `• Location: ${loc}` : "",
            `• Price: ${price}`,
            [type, statusText, beds, baths].filter(Boolean).length ? `• Details: ${[type, statusText, beds, baths].filter(Boolean).join(" • ")}` : "",
            `• View: ${link}`
          ].filter(Boolean).join("\n");
          return `${img}${lines}`;
        }).join("\n\n");
        const statusSlug = (selected || "").toLowerCase().replace(/\s+/g, "-");
        const pageLink = selected ? `/properties/${statusSlug}` : "/properties/for-sale";
        const assistantText = `Here ${samples.length === 1 ? "is a sample property" : `are ${samples.length} sample properties`} for ${selected || "all statuses"}:\n\n${build}\n\nOpen Properties Page: ${pageLink}\n\nYou can type a city to refine further, or choose a budget and bedrooms below.`;
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setQuickActionList(defaultQuickActions);
        setShowInChatQuickActions(true);
        setInquireAwaitingCity(true);
        return;
      } catch (e) {
        const assistantText = "I encountered an issue fetching properties. Please try again or type a city to refine.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setQuickActionList(["For Sale", "For Rent", "Preselling", "RFO", "All"]);
        setShowInChatQuickActions(true);
        setInquireAwaitingCity(true);
        return;
      }
    }

    if (/^Budget ≤ \d+$/i.test(text)) {
      const max = Number(text.replace(/[^0-9]/g, ""));
      setInquireMaxPrice(max);
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      try {
        const qs = new URLSearchParams();
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        if (inquireSelectedCity) qs.set("city", inquireSelectedCity);
        qs.set("maxPrice", String(max));
        if (inquireBedrooms != null) qs.set("bedrooms", String(inquireBedrooms));
        const res = await fetch(`/api/public-listings?${qs.toString()}`, { cache: "no-store" });
        const data = await safeJson(res);
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const build = samples.map((l: any, idx: number) => {
          const price = `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          const loc = makeLoc(l);
          const beds = Number(l.bedrooms) > 0 ? `${l.bedrooms} BR` : "";
          const baths = Number(l.bathrooms) > 0 ? `${l.bathrooms} BA` : "";
          const type = l.type ? `${l.type}` : "";
          const statusText = l.status ? `${l.status}` : "";
          const img = (Array.isArray(l.images) && l.images[0]?.url) ? `![${l.title} — ${price}](${l.images[0].url})\n` : "";
          const link = l.slug ? `/listing/${l.slug}` : `/listing/${l.id}`;
          const lines = [
            `${idx + 1}. ${l.title}`,
            loc ? `• Location: ${loc}` : "",
            `• Price: ${price}`,
            [type, statusText, beds, baths].filter(Boolean).length ? `• Details: ${[type, statusText, beds, baths].filter(Boolean).join(" • ")}` : "",
            `• View: ${link}`
          ].filter(Boolean).join("\n");
          return `${img}${lines}`;
        }).join("\n\n");
        const statusSlug = (inquireFilterStatus || "").toLowerCase().replace(/\s+/g, "-");
        const pageLink = inquireFilterStatus ? `/properties/${statusSlug}` : "/properties/for-sale";
        const assistantText = samples.length ? 
          `Here ${samples.length === 1 ? "is a sample property" : `are ${samples.length} sample properties`} under your budget:\n\n${build}\n\nOpen Properties Page: ${pageLink}` :
          "No properties matched that budget. Try a higher amount or adjust the city or status.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setQuickActionList(defaultQuickActions);
        setShowInChatQuickActions(true);
        return;
      } catch (e) {
        const assistantText = "I encountered an issue applying that budget. Please try again.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        return;
      }
    }

    if (/^Bedrooms \d\+$/i.test(text)) {
      const bedsMin = Number(text.replace(/[^0-9]/g, ""));
      setInquireBedrooms(bedsMin);
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      try {
        const qs = new URLSearchParams();
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        if (inquireSelectedCity) qs.set("city", inquireSelectedCity);
        if (inquireMaxPrice != null) qs.set("maxPrice", String(inquireMaxPrice));
        qs.set("bedrooms", String(bedsMin));
        const res = await fetch(`/api/public-listings?${qs.toString()}`, { cache: "no-store" });
        const data = await safeJson(res);
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const build = samples.map((l: any, idx: number) => {
          const price = `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          const loc = makeLoc(l);
          const btxt = Number(l.bedrooms) > 0 ? `${l.bedrooms} BR` : "";
          const baths = Number(l.bathrooms) > 0 ? `${l.bathrooms} BA` : "";
          const type = l.type ? `${l.type}` : "";
          const statusText = l.status ? `${l.status}` : "";
          const img = (Array.isArray(l.images) && l.images[0]?.url) ? `![${l.title} — ${price}](${l.images[0].url})\n` : "";
          const link = l.slug ? `/listing/${l.slug}` : `/listing/${l.id}`;
          const lines = [
            `${idx + 1}. ${l.title}`,
            loc ? `• Location: ${loc}` : "",
            `• Price: ${price}`,
            [type, statusText, btxt, baths].filter(Boolean).length ? `• Details: ${[type, statusText, btxt, baths].filter(Boolean).join(" • ")}` : "",
            `• View: ${link}`
          ].filter(Boolean).join("\n");
          return `${img}${lines}`;
        }).join("\n\n");
        const statusSlug = (inquireFilterStatus || "").toLowerCase().replace(/\s+/g, "-");
        const pageLink = inquireFilterStatus ? `/properties/${statusSlug}` : "/properties/for-sale";
        const assistantText = samples.length ? 
          `Here ${samples.length === 1 ? "is a sample property" : `are ${samples.length} sample properties`} with bedroom filter:\n\n${build}\n\nOpen Properties Page: ${pageLink}` :
          "No properties matched that bedroom filter. Try a different value or adjust status/city.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setQuickActionList(defaultQuickActions);
        setShowInChatQuickActions(true);
        return;
      } catch (e) {
        const assistantText = "I encountered an issue applying that bedroom filter. Please try again.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        return;
      }
    }

    if (text === "Open Properties Page") {
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      const statusSlug = (inquireFilterStatus || "").toLowerCase().replace(/\s+/g, "-");
      const pageLink = inquireFilterStatus ? `/properties/${statusSlug}` : "/properties/for-sale";
      const assistantText = `You can browse more properties here:\n\n${pageLink}\n\nTell me your budget and target location, and I’ll refine the listings.`;
      const assistantMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant' as const, 
        content: assistantText,
        parts: [{ type: 'text' as const, text: assistantText }]
      };
      const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
      chatInstance.setMessages(newMsgs);
      if (currentInquiryId) {
        syncTranscriptToDb(newMsgs, currentInquiryId);
      }
      setShowInChatQuickActions(true);
      return;
    }
    if (text === "Sell your Property" || text === "Rent out your Property") {
      const isRent = text === "Rent out your Property";
      setPropertyFormMode(isRent ? 'rent' : 'sell');
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      const assistantMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant' as const, 
        content: `I'd be happy to help you ${isRent ? 'rent out' : 'sell'} your property! 🏠\n\nTo get started, could you please provide some details like the location, type, and your desired ${isRent ? 'monthly rent' : 'selling price'}?\n\n**Alternatively, you can click the button below to fill out a quick form:**`,
        parts: [{ 
          type: 'text' as const, 
          text: `I'd be happy to help you ${isRent ? 'rent out' : 'sell'} your property! 🏠\n\nTo get started, could you please provide some details like the location, type, and your desired ${isRent ? 'monthly rent' : 'selling price'}?\n\n**Alternatively, you can click the button below to fill out a quick form:**` 
        }]
      };
      
      const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
      chatInstance.setMessages(newMsgs);
      if (currentInquiryId) {
        syncTranscriptToDb(newMsgs, currentInquiryId);
      }
      return;
    }

    if (text === "Main Menu") {
      // Add user message and then a specific assistant response with the initial quick actions
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: "Back to Main Menu",
        parts: [{ type: 'text' as const, text: "Back to Main Menu" }]
      };
      const assistantMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant' as const, 
        content: "Sure! What else can I help you with? Here are some things I can do for you:",
        parts: [{ 
          type: 'text' as const, 
          text: "Sure! What else can I help you with? Here are some things I can do for you:" 
        }]
      };
      
      const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
      chatInstance.setMessages(newMsgs);
      if (currentInquiryId) {
        syncTranscriptToDb(newMsgs, currentInquiryId);
      }
      return;
    }

    if (text === "No") {
      console.log("DEBUG: Quick action 'No' - checking sendMessage:", typeof chatInstance.sendMessage);
      chatInstance.sendMessage({
        text: "No, thank you. That's all for now."
      }, {
        body: { sessionId: currentSessionId || currentInquiryId || "default_session" }
      });
      return;
    }

    if (text === "Yes") {
      console.log("DEBUG: Quick action 'Yes' - checking sendMessage:", typeof chatInstance.sendMessage);
      chatInstance.sendMessage({
        text: "Yes, I have more questions."
      }, {
        body: { sessionId: currentSessionId || currentInquiryId || "default_session" }
      });
      return;
    }

    console.log("DEBUG: Quick action generic - checking sendMessage:", typeof chatInstance.sendMessage);
    chatInstance.sendMessage({
      text
    }, {
      body: { sessionId: currentSessionId || currentInquiryId || "default_session" }
    });
  };

  const handlePropertyFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { location, type, price, amenities, notes } = propertyFormData;
    
    if (!location || !price) {
      alert("Please provide at least the location and price.");
      return;
    }

    const summary = `🏠 **Property for ${propertyFormMode === 'rent' ? 'Rent' : 'Sale'} Details:**\n\n` +
      `📍 **Location:** ${location}\n` +
      `🏢 **Type:** ${type}\n` +
      `💰 **${propertyFormMode === 'rent' ? 'Desired Monthly Rent' : 'Desired Selling Price'}:** ${price}\n` +
      (amenities ? `✨ **Amenities:** ${amenities}\n` : "") +
      (notes ? `📝 **Notes:** ${notes}` : "");
    
    console.log("DEBUG: Property form submit - checking sendMessage:", typeof chatInstance.sendMessage);
    chatInstance.sendMessage({
      text: summary
    }, {
      body: { sessionId: currentSessionId || currentInquiryId || "default_session" }
    });
    propertyFormJustSubmittedRef.current = true;
    setShowPropertyForm(false);
    setPropertyFormData({
      location: "",
      type: "House and Lot",
      price: "",
      amenities: "",
      notes: ""
    });
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleChatSubmit triggered", { 
      chatInput, 
      hasImage: !!imageFile, 
      isLoading, 
      aiLoading, 
      status: chatInstance.status 
    });

    if (isLoading) {
      console.log("Submit blocked: isLoading is true");
      return;
    }

    if (!chatInput?.trim() && !imageFile) {
      console.log("Submit blocked: no input and no image");
      return;
    }

  const textOnlyAll = (chatInput || "").trim();
  const isFeaturedQuery = /\bfeatured\b/i.test(textOnlyAll);

    if (inquireAwaitingCity && chatInput?.trim()) {
    const typedCity = chatInput.trim();
    if (isFeaturedQuery) {
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: textOnlyAll,
        parts: [{ type: 'text' as const, text: textOnlyAll }]
      };
      try {
        const qs = new URLSearchParams();
        qs.set("featured", "true");
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        const res = await fetch(`/api/public-listings?${qs.toString()}`, { cache: "no-store" });
        const data = await safeJson(res);
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const build = samples.map((l: any, idx: number) => {
          const price = `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          const loc = makeLoc(l);
          const beds = Number(l.bedrooms) > 0 ? `${l.bedrooms} BR` : "";
          const baths = Number(l.bathrooms) > 0 ? `${l.bathrooms} BA` : "";
          const type = l.type ? `${l.type}` : "";
          const statusText = l.status ? `${l.status}` : "";
          const img = (Array.isArray(l.images) && l.images[0]?.url) ? `![${l.title} — ${price}](${l.images[0].url})\n` : "";
          const link = l.slug ? `/listing/${l.slug}` : `/listing/${l.id}`;
          const lines = [
            `${idx + 1}. ${l.title}`,
            loc ? `• Location: ${loc}` : "",
            `• Price: ${price}`,
            [type, statusText, beds, baths].filter(Boolean).length ? `• Details: ${[type, statusText, beds, baths].filter(Boolean).join(" • ")}` : "",
            `• View: ${link}`
          ].filter(Boolean).join("\n");
          return `${img}${lines}`;
        }).join("\n\n");
        const statusSlug = (inquireFilterStatus || "").toLowerCase().replace(/\s+/g, "-");
        const pageLink = inquireFilterStatus ? `/properties/${statusSlug}` : "/properties/for-sale";
        const assistantText = samples.length
          ? `Here ${samples.length === 1 ? "is a featured property" : `are ${samples.length} featured properties`}:\n\n${build}\n\nOpen Properties Page: ${pageLink}`
          : "No featured properties were found. Try adjusting status or browse the properties page.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setQuickActionList(["Budget ≤ 2000000", "Budget ≤ 5000000", "Budget ≤ 10000000", "Bedrooms 1+", "Bedrooms 2+", "Bedrooms 3+", "Open Properties Page"]);
        setShowInChatQuickActions(true);
        setChatInput("");
        return;
      } catch (e) {
        const assistantText = "I encountered an issue fetching featured properties. Please try again.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setChatInput("");
        return;
      }
    }
      setInquireSelectedCity(typedCity);
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: typedCity,
        parts: [{ type: 'text' as const, text: typedCity }]
      };
      try {
        const qs = new URLSearchParams();
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        if (typedCity) qs.set("city", typedCity);
        if (inquireMaxPrice != null) qs.set("maxPrice", String(inquireMaxPrice));
        if (inquireBedrooms != null) qs.set("bedrooms", String(inquireBedrooms));
        const res = await fetch(`/api/public-listings?${qs.toString()}`, { cache: "no-store" });
        const data = await safeJson(res);
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        if (samples.length === 0) {
          const assistantText = "I couldn't find matches for that filter. Could you adjust the city or budget, or choose a different status?";
          const assistantMsg = { 
            id: (Date.now() + 1).toString(), 
            role: 'assistant' as const, 
            content: assistantText,
            parts: [{ type: 'text' as const, text: assistantText }]
          };
          const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
          chatInstance.setMessages(newMsgs);
          if (currentInquiryId) {
            syncTranscriptToDb(newMsgs, currentInquiryId);
          }
          setChatInput("");
          setQuickActionList(defaultQuickActions);
          setShowInChatQuickActions(true);
          return;
        }
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const build = samples.map((l: any, idx: number) => {
          const price = `₱${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
          const loc = makeLoc(l);
          const beds = Number(l.bedrooms) > 0 ? `${l.bedrooms} BR` : "";
          const baths = Number(l.bathrooms) > 0 ? `${l.bathrooms} BA` : "";
          const type = l.type ? `${l.type}` : "";
          const statusText = l.status ? `${l.status}` : "";
          const img = (Array.isArray(l.images) && l.images[0]?.url) ? `![${l.title} — ${price}](${l.images[0].url})\n` : "";
          const link = l.slug ? `/listing/${l.slug}` : `/listing/${l.id}`;
          const lines = [
            `${idx + 1}. ${l.title}`,
            loc ? `• Location: ${loc}` : "",
            `• Price: ${price}`,
            [type, statusText, beds, baths].filter(Boolean).length ? `• Details: ${[type, statusText, beds, baths].filter(Boolean).join(" • ")}` : "",
            `• View: ${link}`
          ].filter(Boolean).join("\n");
          return `${img}${lines}`;
        }).join("\n\n");
        const statusSlug = (inquireFilterStatus || "").toLowerCase().replace(/\s+/g, "-");
        const pageLink = inquireFilterStatus ? `/properties/${statusSlug}` : "/properties/for-sale";
        const assistantText = `Here ${samples.length === 1 ? "is a sample property" : `are ${samples.length} sample properties`} based on your filter:\n\n${build}\n\nOpen Properties Page: ${pageLink}\n\nYou can choose a budget or bedrooms below, or share your move‑in timeline so I can refine the search.`;
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setQuickActionList(defaultQuickActions);
        setInquireAwaitingCity(false);
        setInquireFilterStatus(null);
        setChatInput("");
        setShowInChatQuickActions(true);
        return;
      } catch (e) {
        const assistantText = "I encountered an issue searching with that filter. Please try again or choose a status below.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: assistantText,
          parts: [{ type: 'text' as const, text: assistantText }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setQuickActionList(["For Sale", "For Rent", "Preselling", "RFO", "All"]);
        setShowInChatQuickActions(true);
        setChatInput("");
        return;
      }
    }

    let finalContent = chatInput;
    setIsUploading(true);

    try {
      const textOnly = (finalContent || "").trim();
      const isGreeting = /^\s*(hi|hello|hey|good\s*(morning|afternoon|evening)|kumusta|kamusta)\b/i.test(textOnly);
      const isIdentityQuery = /\b(my name|who am i)\b/i.test(textOnly);

      if (isGreeting && !imageFile && !isIdentityQuery) {
        console.log("Handling as local greeting");
        const userMsg = { 
          id: Date.now().toString(), 
          role: 'user' as const, 
          content: textOnly,
          parts: [{ type: 'text' as const, text: textOnly }]
        };
        const reply = "Hi! I am Kyuubi, your PhDreamHome AI Assistant. How can I help you today? I can search properties, schedule tours, or help you sell or rent a property.";
        const assistantMsg = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant' as const, 
          content: reply,
          parts: [{ type: 'text' as const, text: reply }]
        };
        const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
        chatInstance.setMessages(newMsgs);
        setShowInChatQuickActions(true);
        if (currentInquiryId) {
          syncTranscriptToDb(newMsgs, currentInquiryId);
        }
        setChatInput("");
        setIsUploading(false);
        return;
      }
      if (imageFile) {
        console.log("Uploading image...");
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `ai-inquiries/${fileName}`;

        const { error } = await supabasePublic.storage
          .from('images')
          .upload(filePath, imageFile);

        if (error) {
          console.error("Supabase upload error:", error);
          throw error;
        }

        const { data: { publicUrl } } = supabasePublic.storage
          .from('images')
          .getPublicUrl(filePath);

        console.log("Image uploaded, publicUrl:", publicUrl);
        finalContent = chatInput ? `${chatInput}\n\n![Property Image](${publicUrl})` : `![Property Image](${publicUrl})`;
      }

      console.log("Preparing to send content:", finalContent);

      console.log("Using sendMessage", { sessionId: currentSessionId || currentInquiryId || "default_session" });
      const wantsCtx = /\b(website|this page|this site|your site)\b/i.test(textOnly);
      const ctx = wantsCtx ? await extractWebsiteContext() : "";
      const payload = ctx ? `${finalContent}\n\n${ctx}` : (finalContent || "Attached a photo for verification.");
      
      console.log("Appending to chat:", { payload, sessionId: currentSessionId || currentInquiryId || "default_session" });
      
      try {
        console.log("DEBUG: chatInstance check before sendMessage:", {
          type: typeof chatInstance,
          hasSendMessage: typeof chatInstance.sendMessage === 'function',
          keys: Object.keys(chatInstance),
          status: (chatInstance as any).status
        });

        if (typeof chatInstance.sendMessage !== 'function') {
          console.error("CRITICAL: chatInstance.sendMessage is not a function!", chatInstance);
          throw new Error(`Chat system error: sendMessage method is missing. Type: ${typeof chatInstance.sendMessage}`);
        }
        
        console.log("Calling chatInstance.sendMessage...");
        await chatInstance.sendMessage({ 
          text: payload
        }, {
          body: { 
            sessionId: currentSessionId || currentInquiryId || "default_session" 
          }
        });
        console.log("sendMessage call finished");
      } catch (err: any) {
        console.error("sendMessage error caught in try/catch:", err);
        throw err;
      }
      
      setChatInput("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      console.error("Error in handleChatSubmit:", error);
      let errorDetail = "Failed to send message. Please try again.";
      if (error) {
        if (typeof error === 'string') {
          errorDetail = `Error: ${error}`;
        } else if (error.message) {
          try {
            const parsed = JSON.parse(error.message);
            errorDetail = `Error: ${parsed.error || error.message}`;
          } catch {
            errorDetail = `Error: ${error.message}`;
          }
        } else {
          errorDetail = `Error: ${JSON.stringify(error)}`;
        }
      }
      alert(errorDetail);
    } finally {
      setIsUploading(false);
      console.log("handleChatSubmit finished");
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatInstance.messages]);

  // Sync transcript to database if we have an active inquiry
  useEffect(() => {
    if (currentInquiryId && chatInstance.messages.length > 0) {
      const timeoutId = setTimeout(() => syncTranscriptToDb(chatInstance.messages), 2000); // Debounce 2s
      return () => {
        clearTimeout(timeoutId);
        if (syncAbortControllerRef.current) {
          syncAbortControllerRef.current.abort();
        }
      };
    }
  }, [chatInstance.messages, currentInquiryId, syncTranscriptToDb]);

  const constraintsRef = useRef(null);
  const isDraggingRef = useRef(false);

  if (!mounted) return null;

  return (
    <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[9999]">
      <motion.div 
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={() => {
          // Small delay to ensure click events are ignored right after dragging
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 100);
        }}
        whileDrag={{ scale: 1.02 }}
        className="fixed bottom-6 right-6 pointer-events-auto cursor-move active:cursor-grabbing select-none"
      >
        <AnimatePresence mode="wait">
        {!isOpen && (
          <div className="flex flex-col items-end gap-3">
            <AnimatePresence>
              {showQuickActions && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="flex flex-col items-end gap-2 mb-2"
                >
                  {/* Welcome Bubble */}
                  <div className="relative bg-[#0B2147] text-white p-4 rounded-2xl rounded-tr-none shadow-xl max-w-[240px] mb-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isDraggingRef.current) {
                          setShowQuickActions(false);
                        }
                      }}
                      className="absolute -top-2 -right-2 bg-white text-black rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors drop-shadow-[0_2px_6px_rgba(126,43,245,0.35)]"
                    >
                      <X size={12} />
                    </button>
                    <p className="text-sm font-medium leading-relaxed">
                      👋 Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  {[
                    { label: "Rent A Property", href: "/properties/for-rent", action: "Rent A Property" },
                    { label: "Pre Selling Properties", href: "/properties/preselling", action: "Pre Selling Properties" },
                    { label: "For Sale House and Lot", href: "/properties/for-sale?type=House%20and%20Lot", action: "For Sale House and Lot" },
                    { label: "Visit a Property Today", action: "Property Visit" }
                        ].map((item, i) => (
                    item.href ? (
                      <Link
                        key={item.label}
                        href={item.href}
                        prefetch={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDraggingRef.current) {
                            e.preventDefault();
                          }
                        }}
                        className="flex items-center gap-2 bg-[#003B73] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-[#002B54] transition-all hover:scale-105 active:scale-95"
                      >
                        {item.label}
                        <ExternalLink size={14} />
                      </Link>
                    ) : (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDraggingRef.current) {
                            setIsOpen(true);
                            setShowChatHistory(false);
                            if (isFormSubmitted) {
                              handleQuickAction(item.action!);
                            }
                          }
                        }}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-purple-700 transition-all hover:scale-105 active:scale-95 w-full justify-center"
                      >
                        {item.label}
                        <Image src="/girl.png" alt="AI" width={18} height={18} className="rounded-full shadow-sm" />
                      </button>
                    )
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => {
                if (!isDraggingRef.current) {
                  setIsOpen(true);
                }
              }}
              className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#0B2147] shadow-2xl transition-all hover:scale-110 hover:shadow-purple-500/50 active:scale-95 cursor-move border border-transparent hover:border-purple-400"
              title="Click to open or drag to move"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/20 to-transparent" />
              <Image 
                src="/girl.png" 
                alt="AI Assistant" 
                width={56} 
                height={56} 
                draggable={false}
                className="h-full w-full object-cover transition-transform group-hover:scale-110 select-none pointer-events-none" 
              />
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border border-white">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </div>
            </button>
          </div>
        )}

        {isOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
              isMinimized ? "h-16 w-64" : "h-[500px] w-80 md:w-96"
            }`}
          >
            {/* Header */}
            <div 
              className={`flex flex-col bg-[#0B2147] text-white transition-colors ${isMinimized ? 'cursor-pointer hover:bg-[#112d5a]' : ''}`}
              onClick={() => {
                if (isMinimized && !isDraggingRef.current) {
                  setIsMinimized(false);
                }
              }}
            >
              {/* Drag Handle Bar */}
              <div 
                className="flex justify-center py-1 bg-white/5 cursor-move active:cursor-grabbing transition-colors hover:bg-white/10" 
                title={isMinimized ? "Click to maximize or drag to move" : "Drag to move"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDraggingRef.current && isMinimized) {
                    setIsMinimized(false);
                  }
                }}
              >
                <GripHorizontal size={12} className="opacity-40" />
              </div>
              <div className="flex items-center justify-between p-4 pt-2">
                <div className="flex items-center gap-2">
                {(!isFormSubmitted || !showChatHistory) && (
                  <button
                    onClick={(e) => { 
                      e.stopPropagation();
                      if (!isDraggingRef.current) {
                        if (isFormSubmitted) { 
                          setShowChatHistory(true);
                        } else { 
                          setIsOpen(false); 
                          setShowQuickActions(true); 
                        } 
                      }
                    }}
                    className="rounded p-1 hover:bg-white/10 transition-colors"
                    aria-label="Return"
                    title="Return"
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                <Image src="/girl.png" alt="PhDreamHome AI Assistant" width={32} height={32} className="rounded-full" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">PhDreamHome AI Assistant</span>
                  <span className="text-[10px] opacity-90 leading-tight">Hi there! I am Kyuubi, your PhDreamHome AI Assistant.</span>
                  {providerInfo && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      <span>Provider:</span>
                      <span className="font-semibold capitalize">{providerInfo.provider}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (!isDraggingRef.current) {
                      setIsMinimized(!isMinimized); 
                    }
                  }}
                  className="rounded p-1 hover:bg-white/10 transition-colors"
                >
                  {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                </button>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (!isDraggingRef.current) {
                      setIsOpen(false); 
                    }
                  }}
                  className="rounded p-1 hover:bg-white/10 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              </div>
            </div>

            {!isMinimized && (
              <>
                {!isFormSubmitted ? (
                  /* Lead Generation Form */
                  <div className="flex-1 flex flex-col items-center justify-center p-3 bg-white">
                    <div className="w-full max-w-[220px] space-y-3">
                      <h3 className="text-sm font-bold text-center text-gray-900 leading-tight">
                        Please fill in the form below before starting the chat.
                      </h3>
                      
                      <form onSubmit={handleFormSubmit} className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="Name *"
                          title="Please enter your full name"
                          required
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                        <input
                          type="email"
                          placeholder="Email *"
                          title="Please enter a valid email address"
                          required
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                        <div className="space-y-1">
                          <input
                             type="tel"
                             placeholder="Phone number *"
                             title="Please enter your 11-digit contact number"
                             required
                             maxLength={11}
                             pattern="\d{11}"
                             className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all text-sm text-gray-700 placeholder:text-gray-400"
                             value={formData.phone}
                             onChange={(e) => {
                               const value = e.target.value.replace(/\D/g, "");
                               if (value.length <= 11) {
                                 setFormData({ ...formData, phone: value });
                               }
                             }}
                           />
                          <p className="text-[10px] text-gray-400 ml-1 italic">Format: 09XX XXX XXXX</p>
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-lg active:scale-[0.98] text-sm"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </div>
                ) : showChatHistory ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                      <div className="text-sm font-bold text-slate-800">Chat history</div>
                      {(() => {
                        const sessionsToRender = Array.isArray(chatSessions) ? chatSessions : [];
                        return sessionsToRender.slice().reverse().map((session, idx) => (
                          <div
                            key={`${session.id}-${idx}`}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer hover:bg-emerald-100 transition-colors"
                            onClick={() => { 
                              if (!isDraggingRef.current) {
                                chatInstance.setMessages(session.messages); 
                                setCurrentSessionId(session.id);
                                setShowChatHistory(false); 
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Image src="/girl.png" alt="PhDreamHome AI Assistant" width={24} height={24} className="rounded-full" />
                              <div className="text-xs font-semibold text-slate-800">Chat {chatSessions.length - idx}</div>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {formatDate(new Date(session.startedAt))} · {formatTime(new Date(session.startedAt))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="border-t p-3 bg-purple-50">
                      <button
                        onClick={async () => {
                          if (isDraggingRef.current) return;
                          const prevMessages = messagesRef.current && messagesRef.current.length ? messagesRef.current : chatInstance.messages;
                          if (prevMessages.length > 0) {
                            const firstIdTs = parseInt(String((prevMessages[0] as any)?.id).match(/(\d{13})/)?.[1] || String(Date.now()), 10);
                            setChatSessions((prev) => {
                              const existingIdx = currentSessionId ? prev.findIndex(s => s.id === currentSessionId) : -1;
                              const prevSessionId = currentSessionId || makeSessionId();
                              const updatedPrev = { id: prevSessionId, messages: prevMessages, startedAt: firstIdTs };
                              let next = [];
                              if (existingIdx >= 0) {
                                next = [...prev];
                                next[existingIdx] = updatedPrev;
                              } else {
                                next = [...prev, updatedPrev];
                              }
                              sessionStorage.setItem("ai_agent_sessions", JSON.stringify(next));
                              return next;
                            });
                          }
                          const greeting = {
                            id: 'greeting-' + Date.now(),
                            role: 'assistant' as const,
                            content: "👋 Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.",
                            parts: [{ type: 'text' as const, text: "👋 Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today." }]
                          };
                          const firstTs = parseInt(String(greeting.id).match(/(\d{13})/)?.[1] || String(Date.now()), 10);
                          const newSessionId = makeSessionId();
                          chatInstance.setMessages([greeting]);
                          setCurrentSessionId(newSessionId);
                          setChatSessions((prev) => {
                            const next = [...prev, { id: newSessionId, messages: [greeting], startedAt: firstTs }];
                            sessionStorage.setItem("ai_agent_sessions", JSON.stringify(next));
                            return next;
                          });
                          setShowChatHistory(false);
                          setSuppressQuickActions(true);
                          if (inquiryIdRef.current) {
                            syncTranscriptToDb([greeting], inquiryIdRef.current);
                          } else {
                            try {
                              if (formData.name && formData.email) {
                                const response = await fetch("/api/leads", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: formData.name, email: formData.email, phone: formData.phone || "" })
                                });
                                if (response.ok) {
                                  const data = await safeJson(response);
                                  const inquiryId = data?.inquiry?.id || null;
                                  if (inquiryId) {
                                    setCurrentInquiryId(inquiryId);
                                    sessionStorage.setItem("ai_agent_inquiry_id", inquiryId);
                                    sessionStorage.setItem("ai_agent_form_submitted", "true");
                                    syncTranscriptToDb([greeting], inquiryId);
                                  }
                                }
                              }
                            } catch (e) {
                              console.error("Failed to create inquiry for new chat:", e);
                            }
                          }
                        }}
                        className="w-full bg-[#7E2BF5] hover:bg-[#6F24E3] text-white font-bold py-2.5 rounded-lg transition-colors shadow-lg active:scale-[0.98] text-sm"
                      >
                        Chat with us &nbsp; &gt;
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Messages */}
                    <div 
                      ref={scrollRef}
                      className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
                    >
                      {showPropertyForm ? (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white rounded-xl p-4 shadow-sm border border-slate-200"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <Image src="/girl.png" alt="AI" width={20} height={20} className="rounded-full" />
                              Property Details
                            </h3>
                            <button 
                              onClick={() => setShowPropertyForm(false)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <form onSubmit={handlePropertyFormSubmit} className="space-y-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-800 mb-2">{propertyFormMode === 'rent' ? 'Rent your Property' : 'Sell your Property'}</div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location</label>
                              <input 
                                required
                                placeholder="e.g. Quezon City, Metro Manila"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-purple-500 bg-gray-100"
                                value={propertyFormData.location}
                                onChange={e => setPropertyFormData({...propertyFormData, location: e.target.value})}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
                                <select 
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-purple-500 bg-white"
                                  value={propertyFormData.type}
                                  onChange={e => setPropertyFormData({...propertyFormData, type: e.target.value})}
                                >
                                  <option>House and Lot</option>
                                  <option>Condominium</option>
                                  <option>Town House</option>
                                  <option>Beach Property</option>
                                  <option>Lot Only</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{propertyFormMode === 'rent' ? 'Desired Monthly Rent' : 'Desired Selling Price'}</label>
                                <input 
                                  required
                                  placeholder={propertyFormMode === 'rent' ? 'e.g. 25,000/mo' : 'e.g. 5M'}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-purple-500 bg-gray-100"
                                  value={propertyFormData.price}
                                  onChange={e => setPropertyFormData({...propertyFormData, price: e.target.value})}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amenities</label>
                              <input 
                                placeholder="e.g. Pool, Garden, 3BR"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-purple-500 bg-gray-100"
                                value={propertyFormData.amenities}
                                onChange={e => setPropertyFormData({...propertyFormData, amenities: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</label>
                              <textarea 
                                placeholder={propertyFormMode === 'rent' ? 'Add rental terms, duration, deposit, rules...' : 'Add selling highlights, upgrades, timeline, negotiable...'}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-purple-500 h-16 resize-none bg-gray-100"
                                value={propertyFormData.notes}
                                onChange={e => setPropertyFormData({...propertyFormData, notes: e.target.value})}
                              />
                            </div>
                            <button 
                              type="submit"
                              className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-purple-700 transition-all active:scale-95"
                            >
                              Submit Details
                            </button>
                          </form>
                        </motion.div>
                      ) : (
                        <>
                          {chatInstance.messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-60">
                              <Image src="/girl.png" alt="AI" width={48} height={48} className="rounded-full shadow-lg border border-purple-100" />
                              <p className="text-xs font-medium text-slate-600">Start a conversation with PhDreamHome AI Assistant</p>
                            </div>
                          )}

                          {chatInstance.messages.map((m: Message, idx: number) => (
                            getMessageText(m).toLowerCase().includes("this chat has been closed") ? (
                              <div key={`${String((m as any).id)}-${idx}`} className="flex items-center gap-2 my-3 text-[11px] text-slate-400">
                                <span className="flex-1 h-px bg-slate-200" />
                                <span>This chat has been closed</span>
                                <span className="flex-1 h-px bg-slate-200" />
                              </div>
                            ) : (
                              (() => {
                                const idStr = String((m as any)?.id || "");
                                const tsMatch = idStr.match(/(\d{13})/);
                                const ts = parseInt(tsMatch ? tsMatch[1] : String(Date.now()), 10);
                                const d = new Date(ts);
                                const latestUserId = (() => {
                                  for (let i = chatInstance.messages.length - 1; i >= 0; i--) {
                                    const mm: any = chatInstance.messages[i] as any;
                                    if (mm.role === 'user') return String(mm.id);
                                  }
                                  return null;
                                })();
                                return (
                                  <div key={`${String((m as any).id)}-${idx}`} className="my-2">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 justify-center mb-2">
                                      <span className="flex-1 h-px bg-slate-200" />
                                      <span>{formatDate(d)}</span>
                                      <span className="flex-1 h-px bg-slate-200" />
                                    </div>
                                    <div className={`flex ${m.role === "user" ? "justify-end items-start" : "justify-start items-start"}`}>
                                      {m.role === "user" && String((m as any).id) === latestUserId && (
                                        <button
                                          onClick={() => {
                                            const text = getMessageText(m);
                                            setChatInput(text);
                                            setSuppressQuickActions(true);
                                            setShowInChatQuickActions(false);
                                            const targetId = String((m as any).id);
                                            const updated = chatInstance.messages.filter((mm: any, idx: number) => String(mm.id) !== targetId || mm.role !== 'user' || idx !== chatInstance.messages.length - 1);
                                            chatInstance.setMessages(updated);
                                            if (inquiryIdRef.current) {
                                              syncTranscriptToDb(updated, inquiryIdRef.current);
                                            }
                                            setTimeout(() => {
                                              if (chatInputRef.current) {
                                                try { chatInputRef.current.focus(); } catch {}
                                              }
                                            }, 10);
                                          }}
                                          title="Edit message"
                                          className="mr-1 inline-flex items-center justify-center rounded-full p-1 bg-white text-purple-700 shadow hover:bg-slate-100"
                                        >
                                          <Undo2 size={12} />
                                        </button>
                                      )}
                                      <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs shadow-sm ${
                                          m.role === "user"
                                            ? "bg-purple-600 text-white rounded-tr-none"
                                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                                        }`}
                                      >
                                        <div className="flex items-center gap-1 mb-1 opacity-70">
                                          {m.role === "user" ? <User size={12} /> : <Image src="/girl.png" alt="AI" width={16} height={16} className="rounded-full" />}
                                          <span className="font-bold uppercase tracking-wider text-[8px]">
                                            {m.role === "user" ? "You" : "PhDreamHome AI Assistant"}
                                          </span>
                                        </div>
                                        {
                                          <div className="whitespace-pre-wrap leading-relaxed text-sm">
                                            {(m as any).parts && Array.isArray((m as any).parts) ? (
                                              (m as any).parts.map((part: any, i: number) => {
                                                if (part.type === "text") {
                                                  return <RenderText key={i} text={part.text} />;
                                                }
                                                if (part.type === "reasoning") {
                                                  return (
                                                    <div key={i} className="my-2 rounded bg-amber-50 p-2 text-[10px] italic border-l-2 border-amber-200">
                                                      {part.text}
                                                    </div>
                                                  );
                                                }
                                                if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                                                  return (
                                                    <div key={i} className="my-2 rounded bg-slate-100 p-2 text-[10px] italic flex items-center gap-2">
                                                      <Image src="/girl.png" alt="AI" width={14} height={14} className="rounded-full animate-pulse" />
                                                      <span>Assistant is performing an action...</span>
                                                    </div>
                                                  );
                                                }
                                                return null;
                                              })
                                            ) : (
                                              <RenderText text={getMessageText(m)} />
                                            )}
                                          </div>
                                        }
                                      </div>
                                    </div>
                                    <div className={`mt-1 text-[10px] text-slate-400 ${m.role === "user" ? "text-right pr-2" : "text-left pl-2"}`}>
                                      {formatTime(d)}
                                    </div>
                                  </div>
                                );
                              })()
                            )
                          ))}
                    </>
                  )}

                      {/* Quick Action Buttons */}
                      {!isLoading && (
                        <div className="flex flex-wrap gap-2 justify-end pr-2">
                          {/* Initial Quick Actions */}
                          {(
                           ((chatInstance.messages.length === 1 && chatInstance.messages[0].role === 'assistant') || 
                           (chatInstance.messages.length > 0 && getMessageText(chatInstance.messages[chatInstance.messages.length - 1]).includes("Here are some things I can do for you:")) ||
                           showInChatQuickActions)
                           && !suppressQuickActions
                           ) ? (
                            quickActionList.map((action) => (
                              <button
                                key={`qa-${action}`}
                                onClick={() => {
                                  setShowInChatQuickActions(false);
                                  handleQuickAction(action);
                                }}
                                className="bg-[#1e293b] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md hover:bg-[#334155] transition-all active:scale-95 border border-slate-700 whitespace-nowrap"
                              >
                                {action}
                              </button>
                            ))
                          ) : null}

                          {/* Closing Conversation Quick Actions */}
                          {chatInstance.messages.length > 1 && 
                           chatInstance.messages[chatInstance.messages.length - 1].role === 'assistant' && 
                           getMessageText(chatInstance.messages[chatInstance.messages.length - 1]).toLowerCase().includes("anything else") && (
                            ["Yes", "No"].map((action) => (
                              <button
                                key={`closing-${action}`}
                                onClick={() => handleQuickAction(action)}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 border whitespace-nowrap ${
                                  action === "Yes" 
                                    ? "bg-purple-600 text-white hover:bg-purple-700 border-purple-500" 
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
                                }`}
                              >
                                {action}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-2 shadow-sm">
                            <Loader2 className="animate-spin text-purple-600" size={16} />
                          </div>
                        </div>
                      )}
                    </div>

                    {!showPropertyForm && (
                      <div className="border-t p-4 bg-purple-50">
                        <div className="mb-2 flex items-center gap-2">
                          <button
                            onClick={() => {
                              const closed = {
                                id: 'closed-' + Date.now(),
                                role: 'assistant' as const,
                                content: "This chat has been closed",
                                parts: [{ type: 'text' as const, text: "This chat has been closed" }]
                              };
                              const newMsgs = [...chatInstance.messages, closed];
                              chatInstance.setMessages(newMsgs);
                              if (inquiryIdRef.current) {
                                syncTranscriptToDb(newMsgs, inquiryIdRef.current);
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs shadow hover:bg-slate-100 transition-colors hover:drop-shadow-[0_6px_10px_rgba(126,43,245,0.25)]"
                          >
                            <X size={12} />
                            <span>End chat</span>
                          </button>
                          <button
                            onClick={() => {
                              setSuppressQuickActions(false);
                              setQuickActionList(defaultQuickActions);
                              setShowInChatQuickActions(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs shadow hover:bg-slate-100 transition-colors hover:drop-shadow-[0_6px_10px_rgba(126,43,245,0.25)]"
                          >
                            <span>Menu</span>
                          </button>
                        </div>
                        <form
                          onSubmit={handleChatSubmit}
                        >
                        {imagePreview && (
                          <div className="relative mb-2 inline-block">
                            <Image 
                              src={imagePreview} 
                              alt="Preview" 
                              width={80}
                              height={80}
                              className="h-20 w-20 object-cover rounded-lg border border-slate-200" 
                            />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        
                          <div className="relative flex items-center gap-2 mt-1">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all shrink-0 ${
                              imageFile ? 'bg-purple-100 text-purple-600' : 'text-slate-400 hover:bg-slate-100 hover:text-purple-600'
                            }`}
                            title="Attach image"
                            disabled={isUploading}
                          >
                            <ImageIcon size={16} />
                          </button>
                          <div className="relative flex-1">
                            <input
                              value={chatInput}
                              onChange={handleChatInputChange}
                              placeholder={imageFile ? "Add a caption..." : "Type your message..."}
                              className="w-full rounded-full border border-slate-200 bg-gray-100 py-2 pl-4 pr-10 text-xs text-black focus:border-purple-500 focus:outline-none transition-all"
                              disabled={isUploading}
                              ref={chatInputRef}
                            />
                            <button
                              type="submit"
                              disabled={isLoading || isUploading || (!chatInput?.trim() && !imageFile)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-white disabled:bg-slate-300 transition-colors hover:drop-shadow-[0_6px_10px_rgba(126,43,245,0.25)]"
                            >
                              {isUploading ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />}
                            </button>
                          </div>
                          </div>
                        </form>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </div>
  );
}
