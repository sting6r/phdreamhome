"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat, type UIMessage as Message } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Script from "next/script";
import { X, Send, User, Minimize2, Maximize2, Loader2, ExternalLink, Image as ImageIcon, ChevronLeft, Undo2, GripHorizontal, Building2, MapPin, Info, Sparkles, ClipboardList, ChevronRight, Share2, Copy, Facebook, Twitter, Check, Mic, MicOff, Phone, Mail, Link as LinkIcon, Calendar, Clock
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getProxyImageUrl } from "@/lib/image-utils";

const PesoSign = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 6h8a3 3 0 0 1 0 6H7" />
    <path d="M7 12h8a3 3 0 0 1 0 6H7" />
    <path d="M5 9h10" />
    <path d="M5 15h10" />
    <path d="M7 6v12" />
  </svg>
);

export default function AIAgent() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    // Handled in combined useEffect
  }, [pathname]);

  const [isMinimized, setIsMinimized] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showInChatQuickActions, setShowInChatQuickActions] = useState(false);
  const [suppressQuickActions, setSuppressQuickActions] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [currentInquiryId, setCurrentInquiryId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [agentProfileImage, setAgentProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    async function fetchAgentProfile() {
      const agentProfileController = new AbortController();
      const agentProfileTimeoutId = setTimeout(() => agentProfileController.abort(), 30000);
      try {
        // Try to get from session storage first
        const cacheKey = "agent-profile-data";
        const cacheExpKey = "agent-profile-exp";
        const now = Date.now();
        const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
        const exp = typeof sessionStorage !== "undefined" ? Number(sessionStorage.getItem(cacheExpKey) || 0) : 0;
        
        if (cached && exp > now) {
           const data = JSON.parse(cached);
           if (data && data.imageUrl) {
             setAgentProfileImage(data.imageUrl);
           }
           clearTimeout(agentProfileTimeoutId);
           return;
        }

        let res;
        try {
          res = await fetch('/api/public-profile', { signal: agentProfileController.signal });
        } finally {
          clearTimeout(agentProfileTimeoutId);
        }
        
        if (res.ok) {
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("Agent profile parse error. Status:", res.status, "Body:", text.slice(0, 200));
            return;
          }
          
          // Cache the successful response for 5 minutes
          if (typeof sessionStorage !== "undefined" && data) {
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
            sessionStorage.setItem(cacheExpKey, String(now + 300000));
          }

          if (data && data.imageUrl) {
            setAgentProfileImage(data.imageUrl);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Error fetching agent profile:', error);
      } finally {
        clearTimeout(agentProfileTimeoutId);
      }
    }
    fetchAgentProfile();
  }, []);

  const handleShare = (platform: 'facebook' | 'twitter' | 'copy') => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = "Check out PhDreamHome AI Assistant for the best property listings!";
    
    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
    setShowShareMenu(false);
  };

  const [propertyFormData, setPropertyFormData] = useState({
    location: "",
    type: "House and Lot",
    price: "",
    amenities: "",
    notes: ""
  });
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video'; alt?: string } | null>(null);
  const [allMedia, setAllMedia] = useState<{ url: string; type: 'image' | 'video'; alt?: string }[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const inquiryIdRef = useRef<string | null>(null);
  const hasFetchedProfile = useRef(false);
  const propertyFormJustSubmittedRef = useRef<boolean>(false);
  const syncAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const adjustHeight = (el: HTMLTextAreaElement) => {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      };
      const textareas = document.querySelectorAll("textarea");
      textareas.forEach(el => adjustHeight(el as HTMLTextAreaElement));
    }
  }, [chatInput, propertyFormData.notes, isOpen, showPropertyForm]);

  // Define utility functions before they are used in hooks
  const safeJson = async (res: Response) => {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      return null;
    }
  };

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

  const syncTranscriptToDb = useCallback(async (msgs: Message[], id?: string | null) => {
    const targetId = id || inquiryIdRef.current;
    if (!targetId || targetId === "undefined" || targetId === "null" || msgs.length === 0) {
      // console.log("Sync skipped: invalid id or no messages", { targetId, msgCount: msgs.length });
      return;
    }
    
    // Abort any pending sync request
    if (syncAbortControllerRef.current) {
      syncAbortControllerRef.current.abort();
    }
    syncAbortControllerRef.current = new AbortController();
    const signal = syncAbortControllerRef.current.signal;
    const timeoutId = setTimeout(() => {
      if (syncAbortControllerRef.current?.signal === signal) {
        syncAbortControllerRef.current.abort();
      }
    }, 30000);
    
    try {
      // console.log(`Syncing ${msgs.length} messages to inquiry ${targetId}`);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const cleaned = sanitizeMessages(msgs as any[]);
      
      let res;
      try {
        res = await fetch(`${origin}/api/inquiries/${targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: cleaned }),
          signal,
          cache: 'no-store', // Avoid caching for PATCH requests
        });
      } finally {
        clearTimeout(timeoutId);
      }
      
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
        // console.log("Sync successful");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // console.log("Sync aborted (superseded by a new request)");
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

  // Sync state to ref
  useEffect(() => {
    inquiryIdRef.current = currentInquiryId;
  }, [currentInquiryId]);
  
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: {
      sessionId: currentSessionId || currentInquiryId || "default_session",
      userData: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone
      }
    }
  }), [currentSessionId, currentInquiryId, formData.name, formData.email, formData.phone]);

  const chatInstance = useChat({
    transport,
    id: "ai-agent-chat",
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
      // console.log("AI Chat Finished:", message);
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
    /* console.log("DEBUG: chatInstance full keys:", Object.keys(chatInstance));
    console.log("DEBUG: useChat available methods:", { 
      hasSendMessage: typeof (chatInstance as any).sendMessage === 'function',
      hasReload: typeof (chatInstance as any).reload === 'function',
      hasRegenerate: typeof (chatInstance as any).regenerate === 'function',
      status: status
    }); */
  }, [chatInstance]);
  
  const aiLoading = chatInstance.status === 'submitted' || chatInstance.status === 'streaming';

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = chatInstance.messages;
  }, [chatInstance.messages]);

  // Automatically sync transcript to DB when messages change and we have an inquiry ID
  useEffect(() => {
    if (currentInquiryId && chatInstance.messages.length > 0) {
      // Debounce the sync to avoid too many API calls during streaming
      const timer = setTimeout(() => {
        // Only sync if the last message is from the assistant and it's finished,
        // or if the last message is from the user.
        const lastMsg = chatInstance.messages[chatInstance.messages.length - 1];
        const isAssistantFinished = lastMsg?.role === 'assistant' && chatInstance.status !== 'streaming';
        const isUserMsg = lastMsg?.role === 'user';

        if (isAssistantFinished || isUserMsg) {
          // console.log("Auto-syncing transcript due to message change");
          syncTranscriptToDb(chatInstance.messages, currentInquiryId);
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [chatInstance.messages, currentInquiryId, chatInstance.status, syncTranscriptToDb]);

  const extractWebsiteContext = async (signal?: AbortSignal, query?: string) => {
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
        // Build search URL if we have a query
        let listingsUrl = '/api/public-listings?limit=20';
        if (query) {
          // Extract potential city/location from query
          const locations = ['cebu', 'manila', 'makati', 'quezon', 'davao', 'taguig', 'pasig', 'mandaluyong', 'pasay', 'paranaque', 'las pinas', 'muntinlupa', 'marikina', 'valenzuela', 'malabon', 'navotas', 'pateros', 'antipolo', 'bacolod', 'baguio', 'batangas', 'cabanatuan', 'calamba', 'calbayog', 'calogcan', 'cavite', 'dagupan', 'general santos', 'iloilo', 'lapu-lapu', 'legazpi', 'lucena', 'mandaue', 'naga', 'olongapo', 'ormoc', 'oroquieta', 'pagadian', 'puerto princesa', 'roxas', 'san fernando', 'san jose del monte', 'san pablo', 'santa rosa', 'surigao', 'tacloban', 'tagaytay', 'tagum', 'tarlac', 'tuguegarao', 'zamboanga'];
          const lowerQuery = query.toLowerCase();
          const foundLoc = locations.find(loc => lowerQuery.includes(loc));
          if (foundLoc) {
            listingsUrl += `&city=${encodeURIComponent(foundLoc)}`;
          }
        }

        // Fetch more listings to give the AI better context
        const listingsController = new AbortController();
        const listingsTimeoutId = setTimeout(() => listingsController.abort(), 30000);
        
        // Use the passed signal if available, otherwise use our local controller
        const fetchSignal = signal ? (AbortSignal as any).any([signal, listingsController.signal]) : listingsController.signal;

        let res;
        try {
          res = await fetch(listingsUrl, { 
            cache: 'no-store',
            signal: fetchSignal
          });
        } finally {
          clearTimeout(listingsTimeoutId);
        }
        
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("AI Agent listings fetch parse error. Status:", res.status, "Body:", text.slice(0, 200));
          data = { listings: [] };
        }
        
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const safeListings = Array.isArray(listings) ? listings : [];
        if (safeListings.length) {
          const lines = safeListings.map((l: any, i: number) => {
            const country = String(l?.country || "").toLowerCase();
            let currency = "?";
            if (country.includes("usa") || country.includes("united states")) currency = "$";
            else if (country.includes("dubai") || country.includes("uae") || country.includes("emirates")) currency = "AED ";
            else if (country.includes("singapore")) currency = "S$";

            const price = typeof l?.price === 'number' ? `${currency}${Number(l.price).toLocaleString('en-PH')}` : '';
            const link = l?.slug ? `/listing/${l.slug}` : `/listing/${l?.id}`;
            const img = l?.images?.[0]?.url ? `![${l.title}](${l.images[0].url})\n` : '';
            const loc = [l?.city, l?.state, l?.country].filter(Boolean).join(', ');
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
    if (typeof window === "undefined") return;
    let alive = true;
    const providerController = new AbortController();
    const providerTimeoutId = setTimeout(() => providerController.abort(), 30000);
    (async () => {
      try {
        let res;
        try {
          res = await fetch("/api/chat", { 
            method: "GET", 
            cache: "no-store",
            signal: providerController.signal 
          });
        } finally {
          clearTimeout(providerTimeoutId);
        }
        
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("AI Agent chat config parse error:", text.slice(0, 200));
          return;
        }

        if (!alive) return;
        if (data && (data.provider || data.model)) {
          setProviderInfo({ provider: String(data.provider || ""), model: String(data.model || "") });
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
      } finally {
        clearTimeout(providerTimeoutId);
      }
    })();
    return () => { alive = false; };
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mounted || hasFetchedProfile.current || typeof window === "undefined") return;
    hasFetchedProfile.current = true;

    // Check localStorage for returning visitor
    const visitorData = localStorage.getItem("ai_agent_visitor_data");
    if (visitorData) {
      try {
        const parsed = JSON.parse(visitorData);
        if (parsed.name && parsed.email) {
          setIsReturningVisitor(true);
          // Pre-fill form data but don't set as submitted yet until they verify
          setFormData(prev => ({ ...prev, name: parsed.name, email: parsed.email, phone: parsed.phone || "" }));
        }
      } catch (e) {
        console.error("Error parsing visitor data:", e);
      }
    }

    const profileHistoryController = new AbortController();
    const sig = profileHistoryController.signal;
    const profileHistoryTimeoutId = setTimeout(() => profileHistoryController.abort(), 30000);

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
        const profileController = new AbortController();
        const profileTimeoutId = setTimeout(() => profileController.abort(), 30000);
        
        let res;
        try {
          res = await fetch("/api/profile", { 
            signal: (AbortSignal as any).any([sig, profileController.signal]), 
            cache: "no-store",
            headers: { "Accept": "application/json" }
          });
        } finally {
          clearTimeout(profileTimeoutId);
        }

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
            const leadController = new AbortController();
            const leadTimeoutId = setTimeout(() => leadController.abort(), 30000);
            
            let leadRes;
            try {
              leadRes = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: (AbortSignal as any).any([sig, leadController.signal]),
                body: JSON.stringify({ 
                  name: profile.name, 
                  email: profile.email, 
                  phone: profile.phone || "" 
                }),
              });
            } finally {
              clearTimeout(leadTimeoutId);
            }

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
                  content: "?? Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.",
                  parts: [{ type: 'text' as const, text: "?? Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today." }]
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
      try { profileHistoryController.abort(); } catch {}
    };
  }, [mounted, syncTranscriptToDb, chatInstance, currentInquiryId]);
  
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
    setVerificationError(null);

    // Validation logic
    const isPhoneRequired = !isReturningVisitor;
    const hasName = !!formData.name.trim();
    const hasEmail = !!formData.email.trim();
    const hasPhone = !!formData.phone.trim();

    if (hasName && hasEmail && (!isPhoneRequired || hasPhone)) {
      const leadsController = new AbortController();
      const leadsTimeoutId = setTimeout(() => leadsController.abort(), 30000);
      try {
        let response;
        try {
          response = await fetch("/api/leads", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            signal: leadsController.signal,
            body: JSON.stringify(formData),
          });
        } finally {
          clearTimeout(leadsTimeoutId);
        }

        if (response.ok) {
          const data = await safeJson(response);
          if (data) {
            const inquiryId = data.inquiry?.id || null;
            const transcript = data.inquiry?.transcript;
            
            // Save to localStorage for future visits
            localStorage.setItem("ai_agent_visitor_data", JSON.stringify(formData));
            
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
            } else if (isReturningVisitor && !data.alreadyExists) {
              // If we thought they were returning but no record found in DB,
              // we should probably ask them to provide their phone number to register as a new client
              // or tell them the verification failed.
              if (!formData.phone) {
                setIsFormSubmitted(false);
                setVerificationError("We couldn't find your previous chat history. Please provide your phone number to start a new session.");
                setIsReturningVisitor(false); // Switch to new visitor mode to show phone field
                return;
              }
            }

            // Automatically trigger the greeting message if no history
            const greeting = {
              id: 'greeting-' + Date.now(),
              role: 'assistant' as const,
              content: "?? Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.",
              parts: [{ type: 'text' as const, text: "?? Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today." }]
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
          setVerificationError(errData?.error || "Failed to verify. Please check your details.");
        }
      } catch (error) {
        console.error("Error submitting lead form:", error);
        setVerificationError("An error occurred. Please try again.");
      }
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && isFormSubmitted && !currentInquiryId && !currentSessionId) {
      setShowChatHistory(true);
    }
  }, [isOpen, isFormSubmitted, currentInquiryId, currentSessionId]);

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
  const formatDate = (d: Date) => !mounted ? "..." : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const formatTime = (d: Date) => !mounted ? "..." : d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const makeSessionId = () => {
    try {
      const rnd = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      return `session-${rnd}`;
    } catch {
      return `session-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    }
  };

  const RenderText = ({ text }: { text: string }) => {
    // Collect all media items from the current message text
    const mediaItems = useMemo(() => {
      const items: { url: string; type: 'image' | 'video'; alt?: string }[] = [];
      const matches = text.matchAll(/!\[(.*?)\]\((.*?)\)/g);
      for (const match of matches) {
        const alt = match[1];
        const url = match[2];
        const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || url.includes('/videos/') || url.includes('video');
        items.push({ url, type: isVideo ? 'video' : 'image', alt });
      }
      return items;
    }, [text]);

    const handleMediaClick = (url: string) => {
      const index = mediaItems.findIndex(item => item.url === url);
      if (index !== -1) {
        setAllMedia(mediaItems);
        setCurrentMediaIndex(index);
        setPreviewMedia(mediaItems[index]);
      }
    };

    return (
      <>
        {text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\)|\[PROPERTY_DETAILS\][\s\S]*?\[\/PROPERTY_DETAILS\]|\[CHOICES\][\s\S]*?\[\/CHOICES\])/g).map((part, index) => {
          if (!part) return null;

          // Handle Choices/Buttons
          if (part.startsWith('[CHOICES]')) {
            const content = part.replace('[CHOICES]', '').replace('[/CHOICES]', '').trim();
            const allOptions = content.split('|').map(opt => opt.trim()).filter(Boolean);
            
            // Filter contact-related options unless explicitly relevant or asked for by the user/AI context
            const contactKeywords = ['send message', 'call agent', 'email agent', 'inquire', 'contact us', 'call us', 'contact agent', 'email us'];
            const options = allOptions.filter(opt => {
              const lower = opt.toLowerCase();
              if (contactKeywords.includes(lower)) {
                // Only show contact buttons if the current AI message context mentions contacting or if specifically requested
                const textLower = text.toLowerCase();
                const hasContactIntent = textLower.includes('contact') || 
                                       textLower.includes('speak') || 
                                       textLower.includes('agent') || 
                                       textLower.includes('call') || 
                                       textLower.includes('email') || 
                                       textLower.includes('reach out') ||
                                       textLower.includes('inquire') ||
                                       textLower.includes('number') ||
                                       textLower.includes('address');
                return hasContactIntent;
              }
              return true;
            });

            if (options.length === 0) return null;
            
            return (
              <div key={index} className="flex flex-wrap gap-2 my-3">
                {options.map((option, optIdx) => (
                  <button
                    key={optIdx}
                    disabled={isLoading}
                    onClick={() => {
                      if (!isLoading) {
                        // console.log(`[AIAgent] Button clicked: "${option}"`);
                        
                        // Handle special routing buttons
                         const lowerOpt = option.toLowerCase();
                         if (lowerOpt === 'send message' || lowerOpt === 'inquire' || lowerOpt === 'contact us') {
                           // Display a polite message first
                           const politeMsg = {
                             id: Date.now().toString(),
                             role: 'assistant' as const,
                             content: `Please check our contact page on our website to send a message.`,
                             parts: [{ 
                               type: 'text' as const, 
                               text: `Please check our contact page on our website to send a message.` 
                             }]
                           };
                           chatInstance.setMessages([...chatInstance.messages, politeMsg]);
                           
                           // Delay the routing slightly so the user can see the message
                           setTimeout(() => {
                             router.push('/contact');
                           }, 2000);
                           return;
                         }
                         if (lowerOpt === 'call agent' || lowerOpt === 'call us' || lowerOpt === 'contact agent') {
                           // Display only the contact number in a styled div
                           const phoneMsg = {
                             id: Date.now().toString(),
                             role: 'assistant' as const,
                             content: `[PHONE_DISPLAY]09772838819[/PHONE_DISPLAY]`,
                             parts: [{ 
                               type: 'text' as const, 
                               text: `[PHONE_DISPLAY]09772838819[/PHONE_DISPLAY]` 
                             }]
                           };
                           chatInstance.setMessages([...chatInstance.messages, phoneMsg]);
                           return;
                         }
                         if (lowerOpt === 'view listings' || lowerOpt === 'see properties') {
                          router.push('/properties');
                          return;
                        }
                        if (lowerOpt === 'email agent' || lowerOpt === 'email us') {
                          // Display only the email address in a styled div
                          const emailMsg = {
                            id: Date.now().toString(),
                            role: 'assistant' as const,
                            content: `[EMAIL_DISPLAY]deladonesadlawan@gmail.com[/EMAIL_DISPLAY]`,
                            parts: [{ 
                              type: 'text' as const, 
                              text: `[EMAIL_DISPLAY]deladonesadlawan@gmail.com[/EMAIL_DISPLAY]` 
                            }]
                          };
                          chatInstance.setMessages([...chatInstance.messages, emailMsg]);
                          return;
                        }
                        if (lowerOpt === 'schedule a tour' || lowerOpt === 'book a tour' || lowerOpt === 'visit property') {
                          // Insert a system message into the chat that will render the form
                          const tourFormMsg = {
                            id: Date.now().toString(),
                            role: 'assistant' as const,
                            content: `[TOUR_FORM]\nProperty: ${chatInput || 'Selected Property'}\n[/TOUR_FORM]`,
                            parts: [{ 
                              type: 'text' as const, 
                              text: `[TOUR_FORM]\nProperty: ${chatInput || 'Selected Property'}\n[/TOUR_FORM]` 
                            }]
                          };
                          chatInstance.setMessages([...chatInstance.messages, tourFormMsg]);
                          return;
                        }

                        setChatInput(option);
                        // Use append if available, otherwise fallback to form submission
                        const chat = chatInstance as any;
                        if (typeof chat.append === 'function') {
                          chat.append({ role: 'user', content: option });
                        } else {
                          setChatInput(option);
                          setTimeout(() => {
                            handleChatSubmit(new Event('submit') as any);
                          }, 10);
                        }
                      }
                    }}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {option}
                  </button>
                ))}
              </div>
            );
          }

          // Handle Phone Display
          if (part.startsWith('[PHONE_DISPLAY]')) {
            const phoneNumber = part.replace('[PHONE_DISPLAY]', '').replace('[/PHONE_DISPLAY]', '').trim();
            return (
              <div key={index} className="my-2 flex items-center gap-2 text-sm text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 w-fit">
                <Phone size={16} className="text-green-600" />
                <a href={`tel:${phoneNumber.replace(/\s/g, '')}`} className="font-semibold hover:text-green-600 transition-colors">
                  {phoneNumber}
                </a>
              </div>
            );
          }

          // Handle Email Display
          if (part.startsWith('[EMAIL_DISPLAY]')) {
            const email = part.replace('[EMAIL_DISPLAY]', '').replace('[/EMAIL_DISPLAY]', '').trim();
            return (
              <div key={index} className="my-2 flex items-center gap-2 text-sm text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 w-fit">
                <Mail size={16} className="text-blue-500" />
                <a href={`mailto:${email}`} className="font-semibold hover:text-blue-500 transition-colors">
                  {email}
                </a>
              </div>
            );
          }

          // Handle Agent Card
          if (part.startsWith('[AGENT_CARD]')) {
            const content = part.replace('[AGENT_CARD]', '').replace('[/AGENT_CARD]', '').trim();
            const lines = content.split('\n');
            const data: Record<string, string> = {};
            lines.forEach(line => {
              const [key, ...val] = line.split(':');
              if (key && val.length) {
                data[key.trim()] = val.join(':').trim();
              }
            });

            // Dynamic image for agent card, fallback to agentProfileImage or null
            const agentImage = data.Image || agentProfileImage;

            return (
              <div key={index} className="my-3 bg-[#FDFCFE] border border-slate-100 rounded-2xl overflow-hidden shadow-sm text-slate-800 max-w-sm mx-auto sm:max-w-none">
                <div className="p-5 sm:p-6 flex flex-row items-center gap-6">
                  {/* Agent Image - Left side circular */}
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white flex-shrink-0 bg-slate-50 shadow-sm">
                    {agentImage ? (
                      <Image 
                        src={getProxyImageUrl(agentImage)} 
                        alt={data.Name || "Agent"} 
                        fill 
                        className="object-cover"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as any;
                          target.style.display = 'none';
                          target.parentElement.classList.add('flex', 'items-center', 'justify-center', 'bg-slate-100');
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
                        <User size={48} />
                      </div>
                    )}
                  </div>

                  {/* Agent Info - Right side */}
                  <div className="flex-1 space-y-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight truncate">
                      {data.Name || "Del Adones Adlawan"}
                    </h3>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {data.Role || "REAL ESTATE AGENT"}
                    </p>
                    
                    <div className="space-y-0.5 pt-1">
                      {data.PRC && (
                        <p className="text-xs sm:text-sm text-slate-700">
                          <span className="font-bold">PRC Accred. No:</span> {data.PRC}
                        </p>
                      )}
                      {data.DHSUD && (
                        <p className="text-xs sm:text-sm text-slate-700">
                          <span className="font-bold">DHSUD Accred. No:</span> {data.DHSUD}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      {data.Phone && (
                        <a href={`tel:${data.Phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-xs sm:text-sm text-green-600 font-medium hover:underline">
                          <Phone size={14} />
                          <span>{data.Phone}</span>
                        </a>
                      )}
                      {data.Email && (
                        <a href={`mailto:${data.Email}`} className="flex items-center gap-2 text-xs sm:text-sm text-blue-500 font-medium hover:underline truncate">
                          <Mail size={14} />
                          <span className="truncate">{data.Email}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-xs sm:text-sm font-bold text-green-600">
                      <span className="text-lg">{data.Listings || "5"}</span>
                      <span>Total Listings</span>
                    </div>
                  </div>
                </div>

                {/* Actions - Bottom buttons matching the image */}
                <div className="px-5 pb-5 sm:px-6 sm:pb-6 flex items-center gap-3">
                  <button 
                    onClick={() => router.push('/contact')}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#10A34E] text-white px-4 py-3 text-sm font-bold hover:bg-[#0E8F44] shadow-sm transition-all active:scale-95 group"
                  >
                    <Send size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    <span>Send Inquiry</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(window.location.origin);
                        alert("Link copied to clipboard!");
                      } catch {}
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F0F4F8] text-[#475467] px-4 py-3 text-sm font-bold hover:bg-[#E2E8F0] border border-slate-100 transition-all active:scale-95"
                  >
                    <Copy size={18} />
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>
            );
          }

          // Handle Tour Schedule Form
          if (part.startsWith('[TOUR_FORM]')) {
            const content = part.replace('[TOUR_FORM]', '').replace('[/TOUR_FORM]', '').trim();
            const lines = content.split('\n');
            const data: Record<string, string> = {};
            lines.forEach(line => {
              const [key, ...val] = line.split(':');
              if (key && val.length) {
                data[key.trim()] = val.join(':').trim();
              }
            });

            return (
              <div key={index} className="my-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-slate-800">
                <div className="bg-purple-600 px-3 py-2 flex items-center gap-2 text-white">
                  <Calendar size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Schedule a Property Tour</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-slate-400 uppercase">Property</div>
                    <div className="text-sm font-semibold text-slate-700">{data.Property || "Selected Property"}</div>
                  </div>

                  <form className="space-y-3" onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const date = (form.elements.namedItem('tour-date') as HTMLInputElement).value;
                    const time = (form.elements.namedItem('tour-time') as HTMLInputElement).value;
                    const type = (form.elements.namedItem('tour-type') as HTMLSelectElement).value;

                    if (!date || !time) {
                      alert("Please select both a date and time for your tour.");
                      return;
                    }

                    const confirmationText = `I've scheduled a ${type} for ${data.Property} on ${date} at ${time}.`;
                    
                    // Add user confirmation and then assistant confirmation
                    const userMsg = {
                      id: Date.now().toString(),
                      role: 'user' as const,
                      content: `I'd like to schedule a ${type} for ${date} at ${time}.`,
                      parts: [{ type: 'text' as const, text: `I'd like to schedule a ${type} for ${date} at ${time}.` }]
                    };
                    
                    const assistantMsg = {
                      id: (Date.now() + 1).toString(),
                      role: 'assistant' as const,
                      content: `Perfect! ??? Your ${type} has been requested for **${date}** at **${time}**. One of our agents will contact you shortly to confirm the appointment.`,
                      parts: [{ type: 'text' as const, text: `Perfect! ??? Your ${type} has been requested for **${date}** at **${time}**. One of our agents will contact you shortly to confirm the appointment.` }]
                    };

                    const newMsgs = [...chatInstance.messages, userMsg, assistantMsg];
                    chatInstance.setMessages(newMsgs);
                    if (currentInquiryId) {
                      syncTranscriptToDb(newMsgs, currentInquiryId);
                    }
                  }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-400 uppercase flex items-center gap-1">
                          <Calendar size={10} /> Preferred Date
                        </label>
                        <div className="date-input-container">
                          <input 
                            type="date" 
                            name="tour-date" 
                            required
                            min={mounted ? new Date().toISOString().split('T')[0] : ""}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-400 uppercase flex items-center gap-1">
                          <Clock size={10} /> Preferred Time
                        </label>
                        <input 
                          type="time" 
                          name="tour-time" 
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-400 uppercase">Tour Type</label>
                      <select 
                        name="tour-type"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none appearance-none cursor-pointer"
                      >
                        <option value="Physical Tour">In-Person (Physical) Tour</option>
                        <option value="Virtual Tour">Virtual (Video Call) Tour</option>
                      </select>
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-all active:scale-95 shadow-md mt-2 flex items-center justify-center gap-2"
                    >
                      <Check size={16} />
                      Confirm Schedule
                    </button>
                  </form>
                </div>
              </div>
            );
          }

          // Handle Property Details Form
          if (part.startsWith('[PROPERTY_DETAILS]')) {
            const content = part.replace('[PROPERTY_DETAILS]', '').replace('[/PROPERTY_DETAILS]', '').trim();
            const lines = content.split('\n');
            const data: Record<string, string> = {};
            lines.forEach(line => {
              const [key, ...val] = line.split(':');
              if (key && val.length) {
                data[key.trim()] = val.join(':').trim();
              }
            });

            return (
              <div key={index} className="my-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-slate-800">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
                  <ClipboardList size={14} className="text-purple-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Property Submission Details</span>
                </div>
                <div className="p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[9px] font-medium text-slate-400 uppercase">
                        <Info size={10} /> Mode
                      </div>
                      <div className="text-xs font-semibold text-slate-700">{data.Mode}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[9px] font-medium text-slate-400 uppercase">
                        <Building2 size={10} /> Type
                      </div>
                      <div className="text-xs font-semibold text-slate-700">{data.Type}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[9px] font-medium text-slate-400 uppercase">
                      <MapPin size={10} /> Location
                    </div>
                    <div className="text-xs font-semibold text-slate-700">{data.Location}</div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[9px] font-medium text-slate-400 uppercase">
                      <PesoSign size={10} /> {data.Mode === 'Rent' ? 'Monthly Rent' : 'Selling Price'}
                    </div>
                    <div className="text-xs font-bold text-purple-600">
                      {mounted ? (isNaN(Number(data.Price)) ? data.Price : `?${Number(data.Price).toLocaleString('en-PH')}`) : ""}
                    </div>
                  </div>

                  {data.Amenities && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[9px] font-medium text-slate-400 uppercase">
                        <Sparkles size={10} /> Amenities
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed">{data.Amenities}</div>
                    </div>
                  )}

                  {data.Notes && (
                    <div className="space-y-0.5 pt-1 border-t border-slate-100">
                      <div className="text-[9px] font-medium text-slate-400 uppercase">Additional Notes</div>
                      <div className="text-[11px] text-slate-500 italic leading-relaxed">{data.Notes}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Handle Images and Videos using ![alt](url)
          const imageMatch = part.match(/^!\[(.*?)\]\((.*?)\)$/);
          if (imageMatch) {
            const alt = imageMatch[1];
            const url = imageMatch[2];
            const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || url.includes('/videos/') || url.includes('video');
            
            // Check if there is a listing URL associated with this image in the text
            let listingUrl: string | null = null;
            const nextPart = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\)|\[PROPERTY_DETAILS\][\s\S]*?\[\/PROPERTY_DETAILS\])/g)[index + 1];
            if (nextPart && nextPart.includes('/listing/')) {
              const match = nextPart.match(/\/listing\/[^\s]+/);
              if (match) listingUrl = match[0];
            }

            return (
              <div 
                key={index} 
                className="my-2 rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-black/5 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                onClick={() => handleMediaClick(url)}
              >
                {isVideo ? (
                  <div className="relative group">
                    <video src={url} preload="metadata" muted playsInline className="w-full h-auto max-h-80 pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[12px] border-l-purple-600 border-b-[8px] border-b-transparent ml-1" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative group">
                    <Image 
                      src={getProxyImageUrl(url)} 
                      alt={alt} 
                      width={400}
                      height={300}
                      unoptimized
                      className="w-full h-auto object-cover max-h-80 group-hover:opacity-95 transition-opacity"
                      onError={(e) => { 
                        console.error("Image load failed:", url);
                        (e.target as HTMLImageElement).style.display = 'none'; 
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                      <div className="opacity-0 group-hover:opacity-100 bg-white/90 p-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                        <Maximize2 size={18} className="text-purple-600" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-white/80 border-t border-slate-100 p-2 flex flex-col gap-1.5">
                  {alt && <div className="text-[10px] text-slate-500 font-medium leading-tight">{alt}</div>}
                  {listingUrl && (
                    <Link 
                      href={listingUrl}
                      prefetch={false}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center gap-1 bg-purple-600 text-white px-2 py-1 rounded text-[10px] font-semibold hover:bg-purple-700 transition-colors shadow-sm w-fit"
                    >
                      View Listing
                    </Link>
                  )}
                </div>
              </div>
            );
          }

          // Handle Links [text](url)
          const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
          if (linkMatch) {
            const linkText = linkMatch[1];
            const linkUrl = linkMatch[2];
            const isVideo = linkUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || linkUrl.includes('/videos/') || linkUrl.includes('video');

            if (isVideo) {
              return (
                <div key={index} className="my-2 rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-black/5">
                  <video src={linkUrl} controls playsInline preload="auto" className="w-full h-auto max-h-80" />
                  {linkText && <div className="p-2 text-[10px] text-slate-500 bg-white/80 border-t border-slate-100 font-medium">{linkText} (Video)</div>}
                </div>
              );
            }

            return (
              <Link 
                key={index}
                href={linkUrl}
                prefetch={false}
                target={linkUrl.startsWith('http') ? "_blank" : "_self"}
                className="text-purple-600 font-bold underline hover:text-purple-800 transition-colors inline-flex items-center gap-1"
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
                  <Image src="/cat.png" alt="AI" width={18} height={18} className="rounded-full" />
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
                  prefetch={false}
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
      // console.log("File selected:", file.name, file.size);
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
    // console.log("Quick action clicked:", text);
    if (isLoading) {
      // console.log("Quick action blocked: isLoading is true");
      return;
    }

    // Handle special routing buttons
    const lowerText = text.toLowerCase();
    if (lowerText === 'send message' || lowerText === 'inquire' || lowerText === 'contact us') {
      router.push('/contact');
      return;
    }
    if (lowerText === 'call agent' || lowerText === 'call us' || lowerText === 'contact agent') {
      window.location.href = 'tel:09171234567';
      return;
    }
    if (lowerText === 'view listings' || lowerText === 'see properties') {
        router.push('/properties');
        return;
      }
      if (lowerText === 'schedule a tour' || lowerText === 'book a tour' || lowerText === 'visit property') {
        const tourFormMsg = {
          id: Date.now().toString(),
          role: 'assistant' as const,
          content: `[TOUR_FORM]\nProperty: ${text}\n[/TOUR_FORM]`,
          parts: [{ 
            type: 'text' as const, 
            text: `[TOUR_FORM]\nProperty: ${text}\n[/TOUR_FORM]` 
          }]
        };
        chatInstance.setMessages([...chatInstance.messages, tourFormMsg]);
        return;
      }

    if (text === "Property Visit" || text === "Visit a Property Today") {
      if (!isFormSubmitted) {
        setIsOpen(true);
        setShowChatHistory(false);
        return;
      }
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
        content: "I'd be happy to help you schedule a property visit! ??\n\nYou can schedule a tour by clicking the link below:\n\n/contact\n\nAlternatively, tell me which property you're interested in, and I can help you coordinate with an agent directly.",
        parts: [{ 
          type: 'text' as const, 
          text: "I'd be happy to help you schedule a property visit! ??\n\nYou can schedule a tour by clicking the link below:\n\n/contact\n\nAlternatively, tell me which property you're interested in, and I can help you coordinate with an agent directly." 
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
      const searchController = new AbortController();
      const searchTimeoutId = setTimeout(() => searchController.abort(), 30000);
      try {
        const qs = new URLSearchParams();
        if (selected) qs.set("status", selected);
        if (inquireSelectedCity) qs.set("city", inquireSelectedCity);
        if (inquireMaxPrice != null) qs.set("maxPrice", String(inquireMaxPrice));
        if (inquireBedrooms != null) qs.set("bedrooms", String(inquireBedrooms));
        
        let res;
        try {
          res = await fetch(`/api/public-listings?${qs.toString()}`, { 
            cache: "no-store",
            signal: searchController.signal
          });
        } finally {
          clearTimeout(searchTimeoutId);
        }
        
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
        const getCurrency = (l: any) => {
          const country = String(l.country || "").toLowerCase();
          if (country.includes("usa") || country.includes("united states")) return "$";
          if (country.includes("dubai") || country.includes("uae") || country.includes("emirates")) return "AED ";
          if (country.includes("singapore")) return "S$";
          return "?";
        };
        const build = samples.map((l: any, idx: number) => {
          const currency = getCurrency(l);
          const price = `${currency}${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

    if (/^Budget = \d+$/i.test(text)) {
      const max = Number(text.replace(/[^0-9]/g, ""));
      setInquireMaxPrice(max);
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: text,
        parts: [{ type: 'text' as const, text: text }]
      };
      const budgetController = new AbortController();
      const budgetTimeoutId = setTimeout(() => budgetController.abort(), 30000);
      try {
        const qs = new URLSearchParams();
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        if (inquireSelectedCity) qs.set("city", inquireSelectedCity);
        qs.set("maxPrice", String(max));
        if (inquireBedrooms != null) qs.set("bedrooms", String(inquireBedrooms));
        
        let res;
        try {
          res = await fetch(`/api/public-listings?${qs.toString()}`, { 
            cache: "no-store",
            signal: budgetController.signal 
          });
        } finally {
          clearTimeout(budgetTimeoutId);
        }
        
        const data = await safeJson(res);
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const getCurrency = (l: any) => {
          const country = String(l.country || "").toLowerCase();
          if (country.includes("usa") || country.includes("united states")) return "$";
          if (country.includes("dubai") || country.includes("uae") || country.includes("emirates")) return "AED ";
          if (country.includes("singapore")) return "S$";
          return "?";
        };
        const build = samples.map((l: any, idx: number) => {
          const currency = getCurrency(l);
          const price = `${currency}${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
      const bedsController = new AbortController();
      const bedsTimeoutId = setTimeout(() => bedsController.abort(), 30000);
      try {
        const qs = new URLSearchParams();
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        if (inquireSelectedCity) qs.set("city", inquireSelectedCity);
        if (inquireMaxPrice != null) qs.set("maxPrice", String(inquireMaxPrice));
        qs.set("bedrooms", String(bedsMin));
        
        let res;
        try {
          res = await fetch(`/api/public-listings?${qs.toString()}`, { 
            cache: "no-store",
            signal: bedsController.signal
          });
        } finally {
          clearTimeout(bedsTimeoutId);
        }
        
        const data = await safeJson(res);
        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const build = samples.map((l: any, idx: number) => {
          const price = `?${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
        content: `I'd be happy to help you ${isRent ? 'rent out' : 'sell'} your property! ??\n\nTo get started, could you please provide some details like the location, type, and your desired ${isRent ? 'monthly rent' : 'selling price'}?\n\n**Alternatively, you can click the button below to fill out a quick form:**`,
        parts: [{ 
          type: 'text' as const, 
          text: `I'd be happy to help you ${isRent ? 'rent out' : 'sell'} your property! ??\n\nTo get started, could you please provide some details like the location, type, and your desired ${isRent ? 'monthly rent' : 'selling price'}?\n\n**Alternatively, you can click the button below to fill out a quick form:**` 
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
      // console.log("DEBUG: Quick action 'No' - checking sendMessage:", typeof chatInstance.sendMessage);
      chatInstance.sendMessage({
        text: "No, thank you. That's all for now."
      }, {
        body: { 
          sessionId: currentSessionId || currentInquiryId || "default_session",
          userData: formData
        }
      });
      return;
    }

    if (text === "Yes") {
      // console.log("DEBUG: Quick action 'Yes' - checking sendMessage:", typeof chatInstance.sendMessage);
      chatInstance.sendMessage({
        text: "Yes, I have more questions."
      }, {
        body: { 
          sessionId: currentSessionId || currentInquiryId || "default_session",
          userData: formData
        }
      });
      return;
    }

    // console.log("DEBUG: Quick action generic - checking sendMessage:", typeof chatInstance.sendMessage);
    
    let hiddenContext = "";
    if (/\b(property|house|lot|listing|condo|apartment|rent|sale|buy|available|looking for|inventory)\b/i.test(text)) {
      hiddenContext = await extractWebsiteContext(undefined, text);
    }

    chatInstance.sendMessage({
      text
    }, {
      body: { 
        sessionId: currentSessionId || currentInquiryId || "default_session",
        additionalContext: hiddenContext,
        userData: formData
      }
    });
  };

  const handlePropertyFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { location, type, price, amenities, notes } = propertyFormData;
    
    if (!location || !price) {
      alert("Please provide at least the location and price.");
      return;
    }

    const summary = `[PROPERTY_DETAILS]\n` +
      `Mode: ${propertyFormMode === 'rent' ? 'Rent' : 'Sale'}\n` +
      `Location: ${location}\n` +
      `Type: ${type}\n` +
      `Price: ${price}\n` +
      (amenities ? `Amenities: ${amenities}\n` : "") +
      (notes ? `Notes: ${notes}\n` : "") +
      `[/PROPERTY_DETAILS]`;
    
    // console.log("DEBUG: Property form submit - checking sendMessage:", typeof chatInstance.sendMessage);
    
    // Always extract context for property form submission
    const hiddenContext = await extractWebsiteContext(undefined, `${location} ${type}`);

    chatInstance.sendMessage({
      text: summary
    }, {
      body: { 
        sessionId: currentSessionId || currentInquiryId || "default_session",
        additionalContext: hiddenContext,
        userData: formData
      }
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
    // console.log("handleChatSubmit triggered", { 
    //   chatInput, 
    //   hasImage: !!imageFile, 
    //   isLoading, 
    //   aiLoading, 
    //   status: chatInstance.status 
    // });

    if (isLoading) {
      // console.log("Submit blocked: isLoading is true");
      return;
    }

    if (!chatInput?.trim() && !imageFile) {
      // console.log("Submit blocked: no input and no image");
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
      const featuredController = new AbortController();
      const featuredTimeoutId = setTimeout(() => featuredController.abort(), 30000);
      try {
        const qs = new URLSearchParams();
        qs.set("featured", "true");
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        
        let res;
        try {
          res = await fetch(`/api/public-listings?${qs.toString()}`, { 
            cache: "no-store",
            signal: featuredController.signal
          });
        } finally {
          clearTimeout(featuredTimeoutId);
        }
        
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("AI Agent featured listings parse error:", text.slice(0, 200));
          data = { listings: [] };
        }

        const listings = Array.isArray(data?.listings) ? data.listings : [];
        const samples = listings.slice(0, Math.max(1, Math.min(3, listings.length)));
        const makeLoc = (l: any) => [l.address, l.city, l.state, l.country].filter(Boolean).join(", ");
        const build = samples.map((l: any, idx: number) => {
          const price = `?${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
        setQuickActionList(["Budget = 2000000", "Budget = 5000000", "Budget = 10000000", "Bedrooms 1+", "Bedrooms 2+", "Bedrooms 3+", "Open Properties Page"]);
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
      } finally {
        clearTimeout(featuredTimeoutId);
      }
    }
      setInquireSelectedCity(typedCity);
      const userMsg = { 
        id: Date.now().toString(), 
        role: 'user' as const, 
        content: typedCity,
        parts: [{ type: 'text' as const, text: typedCity }]
      };
      const cityController = new AbortController();
      const cityTimeoutId = setTimeout(() => cityController.abort(), 30000);
      try {
        const qs = new URLSearchParams();
        if (inquireFilterStatus) qs.set("status", inquireFilterStatus);
        if (typedCity) qs.set("city", typedCity);
        if (inquireMaxPrice != null) qs.set("maxPrice", String(inquireMaxPrice));
        if (inquireBedrooms != null) qs.set("bedrooms", String(inquireBedrooms));
        
        let res;
        try {
          res = await fetch(`/api/public-listings?${qs.toString()}`, { 
            cache: "no-store",
            signal: cityController.signal
          });
        } finally {
          clearTimeout(cityTimeoutId);
        }
        
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("AI Agent city listings parse error:", text.slice(0, 200));
          data = { listings: [] };
        }

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
          const price = `?${Number(l.price).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
        const assistantText = `Here ${samples.length === 1 ? "is a sample property" : `are ${samples.length} sample properties`} based on your filter:\n\n${build}\n\nOpen Properties Page: ${pageLink}\n\nYou can choose a budget or bedrooms below, or share your move-in timeline so I can refine the search.`;
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
      } finally {
        clearTimeout(cityTimeoutId);
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
        // console.log("Uploading image via API...");
        const formDataUpload = new FormData();
        formDataUpload.append("files", imageFile);
        
        const uploadController = new AbortController();
        const uploadTimeoutId = setTimeout(() => uploadController.abort(), 30000);
        let uploadRes;
        try {
          uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formDataUpload,
            signal: uploadController.signal,
          });
        } finally {
          clearTimeout(uploadTimeoutId);
        }

        const text = await uploadRes.text();
        let uploadData;
        try {
          uploadData = JSON.parse(text);
        } catch (e) {
          console.error("Image upload parse error. Status:", uploadRes.status, "Body:", text.slice(0, 200));
          throw new Error("Invalid server response during upload");
        }

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload image");
        }

        const imageUrl = uploadData.signedUrls?.[0];

        if (!imageUrl) {
          throw new Error("No image URL returned from upload");
        }

        // console.log("Image uploaded successfully:", imageUrl);
        finalContent = chatInput ? `${chatInput}\n\n![Property Image](${imageUrl})` : `![Property Image](${imageUrl})`;
      }

      // console.log("Preparing to send content:", finalContent);

      // console.log("Using sendMessage", { sessionId: currentSessionId || currentInquiryId || "default_session" });
      const wantsCtx = /\b(website|this page|this site|your site)\b/i.test(textOnly);
      
      // Separate visual message from hidden context
      const visualMessage = finalContent || (imageFile ? "Attached a photo for verification." : "");
      let hiddenContext = "";
      
      if (wantsCtx) {
        hiddenContext = await extractWebsiteContext(undefined, textOnly);
      } else if (/\b(property|house|lot|listing|condo|apartment|rent|sale|buy|available|looking for|inventory)\b/i.test(textOnly)) {
        hiddenContext = await extractWebsiteContext(undefined, textOnly);
      }

      // console.log("Sending message with context:", { visualMessage, hasContext: !!hiddenContext });
      
      try {
        if (typeof chatInstance.sendMessage !== 'function') {
          console.error("CRITICAL: chatInstance.sendMessage is not a function!", chatInstance);
          throw new Error(`Chat system error: sendMessage method is missing. Type: ${typeof chatInstance.sendMessage}`);
        }
        
        // console.log("Calling chatInstance.sendMessage...");
        await chatInstance.sendMessage({ 
          text: visualMessage
        }, {
          body: { 
            sessionId: currentSessionId || currentInquiryId || "default_session",
            additionalContext: hiddenContext,
            userData: formData
          }
        });
        // console.log("sendMessage call finished");
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
      // console.log("handleChatSubmit finished");
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewMedia(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Force video play when previewMedia changes
  useEffect(() => {
    if (previewMedia?.type === 'video' && videoRef.current) {
      videoRef.current.load();
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Video play failed:", error);
        });
      }
    }
  }, [previewMedia]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatInstance.messages]);

  // Sync transcript to database if we have an active inquiry
  useEffect(() => {
    if (currentInquiryId && chatInstance.messages.length > 0) {
      const lastMsg = chatInstance.messages[chatInstance.messages.length - 1];
      const isAssistantStreaming = lastMsg?.role === 'assistant' && chatInstance.status === 'streaming';
      
      // Don't sync while assistant is streaming to avoid rapid aborted requests
      if (isAssistantStreaming) return;

      const timeoutId = setTimeout(() => syncTranscriptToDb(chatInstance.messages), 2000); // Debounce 2s
      return () => {
        clearTimeout(timeoutId);
        // We don't necessarily want to abort here if the component is just re-rendering,
        // but the syncTranscriptToDb function already handles aborting the previous one.
      };
    }
  }, [chatInstance.messages, currentInquiryId, chatInstance.status, syncTranscriptToDb]);

  const constraintsRef = useRef(null);
  const isDraggingRef = useRef(false);

  if (!mounted || pathname?.startsWith('/dashboard')) return null;

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
          <>
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
                      ?? Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.
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
                            if (!isFormSubmitted && (item.action === "Property Visit" || item.action === "Visit a Property Today")) {
                              setIsOpen(true);
                              setShowChatHistory(false);
                            } else {
                              setIsOpen(true);
                              setShowChatHistory(false);
                              if (isFormSubmitted) {
                                handleQuickAction(item.action!);
                              }
                            }
                          }
                        }}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-purple-700 transition-all hover:scale-105 active:scale-95 w-full justify-center"
                      >
                        {item.label}
                        <Image src="/cat.png" alt="AI" width={18} height={18} className="rounded-full shadow-sm" />
                      </button>
                    )
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {!showShareMenu && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareMenu(true);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-50 shadow-lg border-2 border-blue-400 text-slate-600 hover:text-purple-600 hover:scale-110 transition-all z-[9998]"
                title="Share AI Assistant"
              >
                <Share2 size={10} />
              </button>
            )}

            {/* Main AI Button */}
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
                src="/cat.png" 
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

          <AnimatePresence>
            {showShareMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="absolute bottom-32 right-0 flex flex-col gap-2 bg-white p-2 rounded-xl shadow-2xl border border-slate-100 z-[9999]"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowShareMenu(false);
                  }}
                  className="absolute -top-2 -right-2 bg-white text-black rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors border border-slate-100 drop-shadow-[0_2px_6px_rgba(126,43,245,0.35)]"
                  title="Close"
                >
                  <X size={12} />
                </button>
                <button
                  onClick={() => handleShare('facebook')}
                  className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium whitespace-nowrap"
                  title="Share on Facebook"
                >
                  <Facebook size={16} /> Facebook
                </button>
                <button
                  onClick={() => handleShare('twitter')}
                  className="p-2 hover:bg-sky-50 text-sky-500 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium whitespace-nowrap"
                  title="Share on Twitter"
                >
                  <Twitter size={16} /> Twitter
                </button>
                <button
                  onClick={() => handleShare('copy')}
                  className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium whitespace-nowrap"
                  title="Copy Link"
                >
                  {isCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />} 
                  {isCopied ? 'Copied!' : 'Copy Link'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
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
                <Image src="/cat.png" alt="PhDreamHome AI Assistant" width={32} height={32} className="rounded-full" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">Kyuubi AI</span>
                  <span className="text-[10px] opacity-90 leading-tight">Hi there! I am Kyuubi, your PhDreamHome AI Assistant.</span>
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
                        {isReturningVisitor 
                          ? "Welcome back! Please verify your details to continue." 
                          : "Please fill in the form below before starting the chat."
                        }
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
                        {!isReturningVisitor && (
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
                        )}
                        
                        {verificationError && (
                          <p className="text-[10px] text-red-500 text-center font-medium bg-red-50 p-2 rounded border border-red-100 animate-pulse">
                            {verificationError}
                          </p>
                        )}

                        <button
                          type="submit"
                          className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-lg active:scale-[0.98] text-sm"
                        >
                          {isReturningVisitor ? "Verify & Continue" : "Send"}
                        </button>
                        
                        {isReturningVisitor && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsReturningVisitor(false);
                              setFormData({ name: "", email: "", phone: "" });
                              setVerificationError(null);
                            }}
                            className="w-full text-[10px] text-gray-500 hover:text-purple-600 transition-colors text-center mt-1"
                          >
                            Not you? Click here to start fresh.
                          </button>
                        )}
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
                              <Image src="/cat.png" alt="PhDreamHome AI Assistant" width={24} height={24} className="rounded-full" />
                              <div className="text-xs font-semibold text-slate-800">Kyuubi AI</div>
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
                            content: "?? Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today.",
                            parts: [{ type: 'text' as const, text: "?? Hi there! I am Kyuubi, your PhDreamHome AI Assistant. Let me help you today." }]
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
                                const newChatLeadsController = new AbortController();
                                const newChatLeadsTimeoutId = setTimeout(() => newChatLeadsController.abort(), 30000);
                                let response;
                                try {
                                  response = await fetch("/api/leads", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    signal: newChatLeadsController.signal,
                                    body: JSON.stringify({ name: formData.name, email: formData.email, phone: formData.phone || "" })
                                  });
                                } finally {
                                  clearTimeout(newChatLeadsTimeoutId);
                                }
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
                              <Image src="/cat.png" alt="AI" width={20} height={20} className="rounded-full" />
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
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-purple-500 resize-none overflow-hidden bg-gray-100"
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
                              <Image src="/cat.png" alt="AI" width={48} height={48} className="rounded-full shadow-lg border border-purple-100" />
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
                                        <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                          {m.role === "user" ? <User size={14} /> : <Image src="/cat.png" alt="AI" width={20} height={20} className="rounded-full" />}
                                          <span className="font-bold uppercase tracking-wider text-[10px]">
                                            {m.role === "user" ? "You" : "Kyuubi AI"}
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
                                                      <Image src="/cat.png" alt="AI" width={14} height={14} className="rounded-full animate-pulse" />
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
                              src={getProxyImageUrl(imagePreview)} 
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
                          <button
                            type="button"
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all shrink-0 ${
                              isRecording 
                                ? 'bg-red-100 text-red-600 animate-pulse ring-2 ring-red-400' 
                                : 'text-slate-400 hover:bg-slate-100 hover:text-purple-600'
                            }`}
                            title={isRecording ? "Stop recording" : "Voice input"}
                            onClick={() => {
                              setIsRecording(!isRecording);
                              // console.log(`[AIAgent] Voice recording: ${!isRecording ? 'ON' : 'OFF'}`);
                            }}
                          >
                            <Mic size={14} />
                          </button>
                          <div className="relative flex-1 flex items-end">
                            <textarea
                              value={chatInput}
                              onChange={(e) => {
                                handleChatInputChange(e as any);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  const form = e.currentTarget.closest('form');
                                  if (form) form.requestSubmit();
                                }
                              }}
                              placeholder={imageFile ? "Add a caption..." : "Type your message..."}
                              className="w-full rounded-2xl border border-slate-200 bg-gray-100 py-2 pl-4 pr-10 text-xs text-black focus:border-purple-500 focus:outline-none transition-all resize-none overflow-hidden min-h-[36px] max-h-[120px] block leading-normal"
                              rows={1}
                              disabled={isUploading}
                              ref={chatInputRef}
                            />
                            <button
                              type="submit"
                              disabled={isLoading || isUploading || (!chatInput?.trim() && !imageFile)}
                              className="absolute right-1 bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-white disabled:bg-slate-300 transition-colors hover:drop-shadow-[0_6px_10px_rgba(126,43,245,0.25)]"
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

      <AnimatePresence>
        {previewMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-8"
          >
            {/* Close button */}
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center gap-2 group"
            >
              <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Back to Chat</span>
              <X size={24} />
            </button>

            {/* Main Content Area */}
            <div className="relative w-full h-full max-w-5xl flex items-center justify-center">
              {/* Navigation - Left */}
              {allMedia.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIndex = (currentMediaIndex - 1 + allMedia.length) % allMedia.length;
                    setCurrentMediaIndex(newIndex);
                    setPreviewMedia(allMedia[newIndex]);
                  }}
                  className="absolute left-0 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors -translate-x-1/2 md:-translate-x-full"
                >
                  <ChevronLeft size={32} />
                </button>
              )}

              {/* Media Display */}
              <div className="relative w-full h-full flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={previewMedia.url}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full h-full flex items-center justify-center"
                  >
                    {previewMedia.type === 'video' ? (
                      <video
                        ref={videoRef}
                        src={previewMedia.url}
                        controls
                        autoPlay
                        muted
                        playsInline
                        preload="auto"
                        className="max-w-full max-h-full rounded-lg shadow-2xl"
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="relative w-full h-full">
                        <Image
                          src={getProxyImageUrl(previewMedia.url)}
                          alt={previewMedia.alt || "Preview"}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation - Right */}
              {allMedia.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIndex = (currentMediaIndex + 1) % allMedia.length;
                    setCurrentMediaIndex(newIndex);
                    setPreviewMedia(allMedia[newIndex]);
                  }}
                  className="absolute right-0 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors translate-x-1/2 md:translate-x-full"
                >
                  <ChevronRight size={32} />
                </button>
              )}
            </div>

            {/* Bottom Info & Counter */}
            <div className="mt-6 text-center">
              {previewMedia.alt && (
                <p className="text-white text-sm md:text-base font-medium mb-2">
                  {previewMedia.alt}
                </p>
              )}
              {allMedia.length > 1 && (
                <div className="inline-flex items-center gap-4 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                  <div className="flex gap-1">
                    {allMedia.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === currentMediaIndex ? 'w-4 bg-purple-500' : 'w-1.5 bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-white/60 text-xs font-mono">
                    {currentMediaIndex + 1} / {allMedia.length}
                  </span>
                </div>
              )}
            </div>

            {/* Close hint for desktop */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-[10px] uppercase tracking-widest hidden md:block">
              Click anywhere outside to close • Press ESC to exit
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </div>
  );
}
