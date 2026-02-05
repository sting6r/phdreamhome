"use client";
import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabasePublic } from "@lib/supabase";

function renderInlineFormatting(text: string) {
  if (typeof text !== "string") return text;
  if (text.trim() === "---") {
    return <hr className="my-6 border-t-2 border-slate-300" />;
  }
  const isList = /^[-•]\s+/.test(text);
  const cleanText = isList ? text.replace(/^[-•]\s+/, "") : text;

  const nodes: (string | ReactNode)[] = [];
  let key = 0;

  function pushFormattedSegment(segment: string) {
    const pattern = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|_(.+?)_|\*(.+?)\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(segment.slice(lastIndex, match.index));
      }
      if (match[1]) {
        nodes.push(
          <strong key={key++}>
            <em>{match[1]}</em>
          </strong>
        );
      } else if (match[2]) {
        nodes.push(<strong key={key++}>{match[2]}</strong>);
      } else if (match[3] || match[4]) {
        nodes.push(<em key={key++}>{match[3] || match[4]}</em>);
      }
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < segment.length) {
      nodes.push(segment.slice(lastIndex));
    }
  }

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(cleanText)) !== null) {
    if (match.index > lastIndex) {
      pushFormattedSegment(cleanText.slice(lastIndex, match.index));
    }
    const linkText = match[1];
    const href = match[2];
    nodes.push(
      <a
        key={key++}
        href={href}
        className="text-blue-600"
        target="_blank"
        rel="noopener noreferrer"
      >
        {linkText}
      </a>
    );
    lastIndex = linkPattern.lastIndex;
  }
  if (lastIndex < cleanText.length) {
    pushFormattedSegment(cleanText.slice(lastIndex));
  }

  if (isList) {
    return (
      <div className="flex items-start gap-1.5 ml-1">
        <span className="mt-1 w-1 h-1 rounded-full bg-orange-600 shrink-0" />
        <div className="flex-1">{nodes}</div>
      </div>
    );
  }

  return nodes;
}

const BLOG_ICON_CATEGORIES = [
  {
    name: "Prop",
    icons: ["🏠", "🏡", "🏘️", "🏙️", "🏢", "🏗️", "📐", "🛋️", "🛏️", "🛁", "🚿", "🚪", "🔑", "🗝️"]
  },
  {
    name: "Loc",
    icons: ["📍", "🗺️", "📞", "📧", "📱", "🌐", "📡", "📮"]
  },
  {
    name: "Biz",
    icons: ["💼", "💰", "💸", "💳", "📈", "📊", "📝", "📋", "🤝", "👔", "👨‍💼", "👩‍💼", "🏦"]
  },
  {
    name: "Tags",
    icons: ["✨", "💎", "⭐", "🌟", "🔥", "💥", "💯", "✅", "⚠️", "⚡", "💡"]
  },
  {
    name: "Plan",
    icons: ["📅", "📆", "🗓️", "⏰", "⏱️", "⏳"]
  },
  {
    name: "Life",
    icons: ["🌳", "🌴", "🌱", "🌿", "🍀", "🏊", "⛱️", "🏖️", "🚗", "🚲", "🛡️", "🔒", "🏋️", "🧘"]
  },
  {
    name: "Fest",
    icons: ["🎉", "🎊", "🎈", "🎁", "🔔", "📣", "📢", "🎯", "🏆", "🥇", "🥈", "🥉"]
  },
  {
    name: "Pub",
    icons: ["🏫", "🏪", "🏬", "🏨", "🏥", "🏛️", "⛪", "🕌"]
  }
];

export default function NewBlogPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [extraBlocks, setExtraBlocks] = useState<Array<string>>([]);
  type BlockSnapshot = { text: string; h1: string; h2: string; h3: string };
  const [descriptionHistory, setDescriptionHistory] = useState<BlockSnapshot[]>([]);
  const [extraHistory, setExtraHistory] = useState<BlockSnapshot[][]>([]);
  const [headingIndex, setHeadingIndex] = useState(0);
  const [heading, setHeading] = useState("");
  const [subHeading, setSubHeading] = useState("");
  const [subHeadingIndex, setSubHeadingIndex] = useState(0);
  const [showSubHeadingConfig, setShowSubHeadingConfig] = useState(false);
  const [subSubHeading, setSubSubHeading] = useState("");
  const [subSubHeadingIndex, setSubSubHeadingIndex] = useState(0);
  const [showSubSubHeadingConfig, setShowSubSubHeadingConfig] = useState(false);
  const [headings, setHeadings] = useState<string[]>([]);
  const [subHeadings, setSubHeadings] = useState<string[]>([]);
  const [subSubHeadings, setSubSubHeadings] = useState<string[]>([]);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [showIconMenu, setShowIconMenu] = useState(false);
  const [activeIconCategory, setActiveIconCategory] = useState(BLOG_ICON_CATEGORIES[0].name);
  const iconMenuRef = useRef<HTMLDivElement | null>(null);
  const [postedBy, setPostedBy] = useState("");
  const [dateText, setDateText] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [imageAreas, setImageAreas] = useState<{ index: number; position: "above" | "below" }[]>([]);
  const [showImageConfig, setShowImageConfig] = useState(false);
  const [imageConfigIndex, setImageConfigIndex] = useState<number | null>(null);
  const [imageConfigPosition, setImageConfigPosition] = useState<"above" | "below">("above");
  const [videoAreas, setVideoAreas] = useState<{ index: number; position: "above" | "below" }[]>([]);
  const [showVideoConfig, setShowVideoConfig] = useState(false);
  const [videoConfigIndex, setVideoConfigIndex] = useState<number | null>(null);
  const [videoConfigPosition, setVideoConfigPosition] = useState<"above" | "below">("above");
  const [imageUploads, setImageUploads] = useState<{ index: number; position: "above" | "below"; path: string; url: string | null }[]>([]);
  const [videoUploads, setVideoUploads] = useState<{ index: number; position: "above" | "below"; path: string; url: string | null }[]>([]);
  const [heroImageUpload, setHeroImageUpload] = useState<{ path: string; url: string | null } | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [blogOption, setBlogOption] = useState("Featured Projects");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [pendingVideoIndex, setPendingVideoIndex] = useState<number | null>(null);
  const [pendingImageIndex, setPendingImageIndex] = useState<number | null>(null);
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [toolsTop, setToolsTop] = useState<number | null>(null);
  const [toolsBox, setToolsBox] = useState<{ left: number; width: number } | null>(null);
  const [toolsLocked, setToolsLocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showLinkConfig, setShowLinkConfig] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkUseMain, setLinkUseMain] = useState(true);
  const [linkBlockIndex, setLinkBlockIndex] = useState<number | null>(null);
  const [linkSelStart, setLinkSelStart] = useState<number | null>(null);
  const [linkSelEnd, setLinkSelEnd] = useState<number | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);
  const extraRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const configRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const heroImageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const toolsLockedRef = useRef(false);
  const [myBlogs, setMyBlogs] = useState<any[]>([]);
  const [myBlogsLoading, setMyBlogsLoading] = useState(false);
  const [myBlogsErr, setMyBlogsErr] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLTextAreaElement | null>(null);
  const subHeadingRef = useRef<HTMLTextAreaElement | null>(null);
  const subSubHeadingRef = useRef<HTMLTextAreaElement | null>(null);
  const headingInputRef = useRef<HTMLInputElement | null>(null);
  const subHeadingInputRef = useRef<HTMLInputElement | null>(null);
  const subSubHeadingInputRef = useRef<HTMLInputElement | null>(null);

  function getMediaPlaceholders(blockIndex: number) {
    const tags: string[] = [];
    let mediaIndex = 0;
    if (heroImageUpload && heroImageUpload.path) {
      mediaIndex++;
    }
    const sortedImages = [...imageUploads].sort((a, b) => a.index - b.index);
    for (const img of sortedImages) {
      if (heroImageUpload && img.path === heroImageUpload.path) continue;
      if (img.index === blockIndex) {
        tags.push(`[image:${mediaIndex}]`);
      }
      mediaIndex++;
    }
    const sortedVideos = [...videoUploads].sort((a, b) => a.index - b.index);
    for (const v of sortedVideos) {
      if (v.index === blockIndex) {
        tags.push(`[video:${mediaIndex}]`);
      }
      mediaIndex++;
    }
    return tags;
  }

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-PH"));
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setMyBlogsLoading(true);
        setMyBlogsErr(null);
        const { data } = await supabasePublic.auth.getSession();
        const token = data.session?.access_token;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch("/api/blog?mine=1", { headers, cache: "no-store" });
        const text = await r.text();
        let j;
        try {
          j = JSON.parse(text);
        } catch(e) {
          console.error("Blog fetch parse error:", r.status, text.slice(0, 200));
          throw new Error("Failed to load blogs: Server error");
        }
        const rows = Array.isArray(j.blogs) ? j.blogs : [];
        if (alive) setMyBlogs(rows);
      } catch (e: any) {
        if (alive) setMyBlogsErr(String(e?.message || e));
      } finally {
        if (alive) setMyBlogsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function publishExisting(id: string) {
    try {
      setActionBusyId(id);
      const { data } = await supabasePublic.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`/api/blog/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ published: true })
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Publish failed");
      setMyBlogs(prev => prev.map(b => (b.id === id ? { ...b, published: true } : b)));
    } catch (e: any) {
      setMyBlogsErr(String(e?.message || e));
    } finally {
      setActionBusyId(null);
    }
  }

  async function deleteExisting(id: string) {
    try {
      setActionBusyId(id);
      const { data } = await supabasePublic.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`/api/blog/${id}`, { method: "DELETE", headers });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        // DELETE returns { ok: true } or error
        if (!r.ok) throw new Error(j?.error || "Delete failed");
      }
      setMyBlogs(prev => prev.filter(b => b.id !== id));
    } catch (e: any) {
      setMyBlogsErr(String(e?.message || e));
    } finally {
      setActionBusyId(null);
    }
  }

  function editExisting(id: string) {
    router.push(`/dashboard/blog/${id}/edit`);
  }

  useEffect(() => {
    function updateTopUnderStatus() {
      const wrapper = document.getElementById("status-links-wrapper");
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      setToolsTop(rect.top + rect.height);
    }

    function measureToolsBox() {
      const container = document.getElementById("tools-container");
      if (container) {
        const rect = container.getBoundingClientRect();
        setToolsBox({ left: rect.left, width: rect.width });
      }
    }

    function handleScroll() {
      const offset = window.scrollY || window.pageYOffset || 0;
      const card = cardRef.current;
      const wrapper = document.getElementById("status-links-wrapper");
      
      if (card && wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const threshold = wrapperRect.top + wrapperRect.height;
        
        // Lock when the card's top reaches the threshold (below status links)
        if (cardRect.top <= threshold) {
          if (!toolsLockedRef.current) {
            toolsLockedRef.current = true;
            setToolsLocked(true);
            measureToolsBox();
          }
        } else if (offset < 10) { // Unfreeze when near the very top (more reliable than 90)
          if (toolsLockedRef.current) {
            toolsLockedRef.current = false;
            setToolsLocked(false);
          }
        }
      }
      updateTopUnderStatus();
    }

    function handleResize() {
      measureToolsBox();
      updateTopUnderStatus();
    }

    window.addEventListener("scroll", handleScroll, { passive: true } as any);
    window.addEventListener("resize", handleResize, { passive: true } as any);
    
    updateTopUnderStatus();
    measureToolsBox();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  function addTextBlock() {
    setExtraBlocks(prev => [...prev, ""]);
    setExtraHistory(prev => [...prev, []]);
  }

  function removeTextBlock(index: number) {
    setExtraBlocks(prev => prev.filter((_, i) => i !== index));
    setExtraHistory(prev => prev.filter((_, i) => i !== index));
    setActiveBlockIndex(prev => {
      if (prev === null) return prev;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }

  function undoDescription() {
    setDescriptionHistory(prev => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next.pop() as BlockSnapshot;
      setDescription(last.text);
      setHeadings(h => {
        const copy = [...h];
        copy[0] = last.h1;
        return copy;
      });
      setSubHeadings(h => {
        const copy = [...h];
        copy[0] = last.h2;
        return copy;
      });
      setSubSubHeadings(h => {
        const copy = [...h];
        copy[0] = last.h3;
        return copy;
      });
      return next;
    });
  }

  function undoExtraBlock(index: number) {
    setExtraHistory(prev => {
      const list = prev[index];
      if (!list || !list.length) return prev;
      const copy = prev.map(arr => [...arr]);
      const last = copy[index].pop() as BlockSnapshot;
      setExtraBlocks(blocks =>
        blocks.map((b, i) => (i === index ? last.text : b))
      );
      setHeadings(h => {
        const next = [...h];
        next[index + 1] = last.h1;
        return next;
      });
      setSubHeadings(h => {
        const next = [...h];
        next[index + 1] = last.h2;
        return next;
      });
      setSubSubHeadings(h => {
        const next = [...h];
        next[index + 1] = last.h3;
        return next;
      });
      return copy;
    });
  }

  function applyTool(tool: "bold" | "italic" | "list" | "separator") {
    const useMain = activeBlockIndex === null;
    const el = useMain ? descRef.current : extraRefs.current[activeBlockIndex] || null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const currentIndex = useMain ? null : activeBlockIndex;
    const value = useMain
      ? description
      : currentIndex !== null && extraBlocks[currentIndex] !== undefined
        ? extraBlocks[currentIndex]
        : "";
    const selected = start !== end ? value.slice(start, end) : "";
    let next = value;
    let selStart = start;
    let selEnd = end;

    if (tool === "bold") {
      const target = selected || "text";
      next = value.slice(0, start) + `**${target}**` + value.slice(end);
      selStart = start + 2;
      selEnd = selStart + target.length;
    } else if (tool === "italic") {
      const target = selected || "text";
      next = value.slice(0, start) + `***${target}***` + value.slice(end);
      selStart = start + 3;
      selEnd = selStart + target.length;
    } else if (tool === "list") {
      if (start === end) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const alreadyList = value.slice(lineStart, lineStart + 2) === "• ";
        if (alreadyList) {
          next = value;
        } else {
          next = value.slice(0, lineStart) + "• " + value.slice(lineStart);
          selStart = selEnd = start + 2;
        }
      } else {
        const segmentStart = value.lastIndexOf("\n", start - 1) + 1;
        const segmentEndIndex = value.indexOf("\n", end);
        const segmentEnd = segmentEndIndex === -1 ? value.length : segmentEndIndex;
        const segment = value.slice(segmentStart, segmentEnd);
        const lines = segment.split("\n");
        const transformed = lines.map(l => (l.startsWith("• ") ? l : `• ${l}`)).join("\n");
        next = value.slice(0, segmentStart) + transformed + value.slice(segmentEnd);
        selStart = segmentStart;
        selEnd = segmentStart + transformed.length;
      }
    } else if (tool === "separator") {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const alreadySep = value.slice(lineStart, lineStart + 4) === "---\n";
      if (alreadySep) {
        next = value;
      } else {
        next = value.slice(0, lineStart) + "---\n" + value.slice(lineStart);
        selStart = selEnd = lineStart + 4;
      }
    }

    if (next !== value) {
      if (useMain) {
        setDescription(prev => {
          setDescriptionHistory(history => {
            const snapshot = {
              text: prev,
              h1: headings[0] || "",
              h2: subHeadings[0] || "",
              h3: subSubHeadings[0] || ""
            };
            const nextH = [...history, snapshot];
            return nextH.length > 10 ? nextH.slice(nextH.length - 10) : nextH;
          });
          return next;
        });
      } else if (currentIndex !== null) {
        setExtraBlocks(prev =>
          prev.map((b, i) => {
            if (i === currentIndex) {
              setExtraHistory(prevHistory => {
                const copy = prevHistory.map(arr => [...arr]);
                if (!copy[currentIndex]) copy[currentIndex] = [];
                const snapshot = {
                  text: b,
                  h1: headings[currentIndex + 1] || "",
                  h2: subHeadings[currentIndex + 1] || "",
                  h3: subSubHeadings[currentIndex + 1] || ""
                };
                copy[currentIndex].push(snapshot);
                if (copy[currentIndex].length > 10) {
                  copy[currentIndex] = copy[currentIndex].slice(copy[currentIndex].length - 10);
                }
                return copy;
              });
              return next;
            }
            return b;
          })
        );
      }
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.selectionStart = selStart;
        el.selectionEnd = selEnd;
      });
    }
  }

  function applyIcon(icon: string) {
    const useMain = activeBlockIndex === null;
    const el = useMain ? descRef.current : extraRefs.current[activeBlockIndex] || null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const currentIndex = useMain ? null : activeBlockIndex;
    const value = useMain
      ? description
      : currentIndex !== null && extraBlocks[currentIndex] !== undefined
        ? extraBlocks[currentIndex]
        : "";
    const next = value.slice(0, start) + icon + value.slice(end);
    const selPos = start + icon.length;

    if (useMain) {
      setDescription(prev => {
        setDescriptionHistory(history => {
          const snapshot = {
            text: prev,
            h1: headings[0] || "",
            h2: subHeadings[0] || "",
            h3: subSubHeadings[0] || ""
          };
          const nextH = [...history, snapshot];
          return nextH.length > 10 ? nextH.slice(nextH.length - 10) : nextH;
        });
        return next;
      });
    } else if (currentIndex !== null) {
      setExtraBlocks(prev =>
        prev.map((b, i) => {
          if (i === currentIndex) {
            setExtraHistory(prevHistory => {
              const copy = prevHistory.map(arr => [...arr]);
              if (!copy[currentIndex]) copy[currentIndex] = [];
              const snapshot = {
                text: b,
                h1: headings[currentIndex + 1] || "",
                h2: subHeadings[currentIndex + 1] || "",
                h3: subSubHeadings[currentIndex + 1] || ""
              };
              copy[currentIndex].push(snapshot);
              if (copy[currentIndex].length > 10) {
                copy[currentIndex] = copy[currentIndex].slice(copy[currentIndex].length - 10);
              }
              return copy;
            });
            return next;
          }
          return b;
        })
      );
    }
    setShowIconMenu(false);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = selPos;
      el.selectionEnd = selPos;
    });
  }

  function openLinkConfig() {
    const useMain = activeBlockIndex === null;
    const el = useMain ? descRef.current : extraRefs.current[activeBlockIndex] || null;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = useMain
      ? description
      : activeBlockIndex !== null && extraBlocks[activeBlockIndex] !== undefined
        ? extraBlocks[activeBlockIndex]
        : "";
    const selected = start !== end ? value.slice(start, end) : "";
    const raw = selected.trim();
    let initialText = raw;
    let initialUrl = raw;
    if (!raw) {
      initialText = "";
      initialUrl = "";
    }
    setLinkUseMain(useMain);
    setLinkBlockIndex(useMain ? null : activeBlockIndex);
    setLinkSelStart(start);
    setLinkSelEnd(end);
    setLinkText(initialText);
    setLinkUrl(initialUrl);
    setShowLinkConfig(true);
    setShowSubHeadingConfig(false);
    setShowSubSubHeadingConfig(false);
  }

  function applyLinkFromConfig() {
    if (!linkUrl && !linkText) {
      setShowLinkConfig(false);
      return;
    }
    const useMain = linkUseMain || linkBlockIndex === null;
    const index = linkBlockIndex;
    const el = useMain ? descRef.current : index !== null ? extraRefs.current[index] || null : null;
    if (!el) {
      setShowLinkConfig(false);
      return;
    }
    const value = useMain
      ? description
      : index !== null && extraBlocks[index] !== undefined
        ? extraBlocks[index]
        : "";
    const start = linkSelStart ?? el.selectionStart ?? 0;
    const end = linkSelEnd ?? el.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const rawUrl = linkUrl.trim() || linkText.trim();
    if (!rawUrl) {
      setShowLinkConfig(false);
      return;
    }
    console.log("Raw URL from link config:", rawUrl);
    const hasScheme = /^https?:\/\//i.test(rawUrl);
    const url = hasScheme ? rawUrl : `https://${rawUrl}`;
    console.log("Processed URL in applyLinkFromConfig:", url);
    const text = (linkText || rawUrl).trim();
    const inserted = `[${text}](${url})`;
    const next = before + inserted + after;
    if (useMain) {
      setDescription(prev => {
        setDescriptionHistory(history => {
          const snapshot = {
            text: prev,
            h1: headings[0] || "",
            h2: subHeadings[0] || "",
            h3: subSubHeadings[0] || ""
          };
          const nextH = [...history, snapshot];
          return nextH.length > 10 ? nextH.slice(nextH.length - 10) : nextH;
        });
        return next;
      });
    } else if (index !== null) {
      setExtraBlocks(prev =>
        prev.map((b, i) => {
          if (i === index) {
            setExtraHistory(prevHistory => {
              const copy = prevHistory.map(arr => [...arr]);
              if (!copy[index]) copy[index] = [];
              const snapshot = {
                text: b,
                h1: headings[index + 1] || "",
                h2: subHeadings[index + 1] || "",
                h3: subSubHeadings[index + 1] || ""
              };
              copy[index].push(snapshot);
              if (copy[index].length > 10) {
                copy[index] = copy[index].slice(copy[index].length - 10);
              }
              return copy;
            });
            return next;
          }
          return b;
        })
      );
    }
    const parenIndex = inserted.indexOf(String.fromCharCode(40));
    const selStartPos = parenIndex === -1 ? before.length + 1 : before.length + parenIndex + 1;
    const selEndPos = parenIndex === -1 ? selStartPos + text.length : selStartPos + url.length;
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = selStartPos;
      el.selectionEnd = selEndPos;
    });
    setShowLinkConfig(false);
  }

  function removeImageArea(index: number) {
    setImageAreas(prev => prev.filter(i => i.index !== index));
    setImageUploads(prev => prev.filter(i => i.index !== index));
    if (imageConfigIndex === index) {
      setImageConfigIndex(null);
      setShowImageConfig(false);
    }
  }

  function removeVideoArea(index: number) {
    setVideoAreas(prev => prev.filter(v => v.index !== index));
    setVideoUploads(prev => prev.filter(v => v.index !== index));
    if (videoConfigIndex === index) {
      setVideoConfigIndex(null);
      setShowVideoConfig(false);
    }
  }

  function getVideoUpload(index: number, position: "above" | "below") {
    return videoUploads.find(v => v.index === index && v.position === position) || null;
  }

  function getImageUpload(index: number, position: "above" | "below") {
    return imageUploads.find(i => i.index === index && i.position === position) || null;
  }

  function startVideoUpload(index: number) {
    if (uploadingIndex !== null) return;
    setPendingVideoIndex(index);
    setUploadError(null);
    setUploadSuccess(null);
    const input = uploadInputRef.current;
    if (input) {
      input.value = "";
      input.click();
    }
  }

  function startImageUpload(index: number) {
    if (uploadingImageIndex !== null) return;
    setPendingImageIndex(index);
    setUploadError(null);
    setUploadSuccess(null);
    const input = imageUploadInputRef.current;
    if (input) {
      input.value = "";
      input.click();
    }
  }

  function buildDescriptionWithHeadings(blocks: string[]) {
    const hasHero = !!(heroImageUpload && heroImageUpload.path);
    const sortedImages = [...imageUploads].sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return a.position === "above" ? -1 : 1;
    });
    const sortedVideos = [...videoUploads].sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return a.position === "above" ? -1 : 1;
    });

    const merged = blocks.map((text, idx) => {
      const lines: string[] = [];

      // Check for media ABOVE
      const imgAbove = imageAreas.find(a => a.index === idx && a.position === "above");
      if (imgAbove) {
        const img = imageUploads.find(u => u.index === idx && u.position === "above");
        if (img) {
          const imgIdx = (hasHero ? 1 : 0) + sortedImages.findIndex(u => u.index === idx && u.position === "above");
          lines.push(`[image:${imgIdx}]`);
        }
      }
      const vidAbove = videoAreas.find(v => v.index === idx && v.position === "above");
      if (vidAbove) {
        const vid = videoUploads.find(u => u.index === idx && u.position === "above");
        if (vid) {
          const vidIdx =
            (hasHero ? 1 : 0) +
            sortedImages.length +
            sortedVideos.findIndex(u => u.index === idx && u.position === "above");
          lines.push(`[video:${vidIdx}]`);
        }
      }

      const h1 = (headings[idx] || "").trim();
      const h2 = (subHeadings[idx] || "").trim();
      const h3 = (subSubHeadings[idx] || "").trim();
      if (h1) lines.push(`# ${h1}`);
      if (h2) lines.push(`## ${h2}`);
      if (h3) lines.push(`### ${h3}`);

      const body = (text || "").trim();
      if (body) lines.push(body);

      // Check for media BELOW
      const imgBelow = imageAreas.find(a => a.index === idx && a.position === "below");
      if (imgBelow) {
        const img = imageUploads.find(u => u.index === idx && u.position === "below");
        if (img) {
          const imgIdx = (hasHero ? 1 : 0) + sortedImages.findIndex(u => u.index === idx && u.position === "below");
          lines.push(`[image:${imgIdx}]`);
        }
      }
      const vidBelow = videoAreas.find(v => v.index === idx && v.position === "below");
      if (vidBelow) {
        const vid = videoUploads.find(u => u.index === idx && u.position === "below");
        if (vid) {
          const vidIdx =
            (hasHero ? 1 : 0) +
            sortedImages.length +
            sortedVideos.findIndex(u => u.index === idx && u.position === "below");
          lines.push(`[video:${vidIdx}]`);
        }
      }

      return lines.join("\n");
    });
    return merged
      .map(s => s.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  async function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    const index = pendingVideoIndex;
    if (!file || index === null) {
      return;
    }
    setUploadingIndex(index);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("files", file);
      const res = await fetch("/api/upload?scope=blog", {
        method: "POST",
        body: form,
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      const path = Array.isArray(data.paths) ? data.paths[0] : null;
      const url = Array.isArray(data.signedUrls) ? data.signedUrls[0] : null;
      if (!path) {
        throw new Error("Upload failed");
      }
      setVideoUploads(prev => {
        const next = prev.filter(v => !(v.index === index && v.position === videoConfigPosition));
        return [...next, { index, position: videoConfigPosition, path, url }];
      });
      setUploadSuccess("Successfully added video");
    } catch (e: any) {
      setUploadError(String(e?.message || e));
    } finally {
      setUploadingIndex(null);
      setPendingVideoIndex(null);
      e.target.value = "";
    }
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    const index = pendingImageIndex;
    if (!file || index === null) {
      return;
    }
    setUploadingImageIndex(index);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("files", file);
      const res = await fetch("/api/upload?scope=blog", {
        method: "POST",
        body: form,
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      const path = Array.isArray(data.paths) ? data.paths[0] : null;
      const url = Array.isArray(data.signedUrls) ? data.signedUrls[0] : null;
      if (!path) {
        throw new Error("Upload failed");
      }
      setImageUploads(prev => {
        const next = prev.filter(i => !(i.index === index && i.position === imageConfigPosition));
        return [...next, { index, position: imageConfigPosition, path, url }];
      });
      setUploadSuccess("Successfully added image");
    } catch (e: any) {
      setUploadError(String(e?.message || e));
    } finally {
      setUploadingImageIndex(null);
      setPendingImageIndex(null);
      e.target.value = "";
    }
  }

  function formatDateInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const len = digits.length;
    if (!len) return "";
    if (len <= 2) return digits;
    if (len <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function isValidDateText(text: string) {
    const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }

  async function handleHeroImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) {
      return;
    }
    setUploadingHeroImage(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("files", file);
      const res = await fetch("/api/upload?scope=blog", {
        method: "POST",
        body: form,
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      const path = Array.isArray(data.paths) ? data.paths[0] : null;
      const url = Array.isArray(data.signedUrls) ? data.signedUrls[0] : null;
      if (!path) {
        throw new Error("Upload failed");
      }
      setHeroImageUpload({ path, url });
      setUploadSuccess("Successfully added hero image");
    } catch (e: any) {
      setUploadError(String(e?.message || e));
    } finally {
      setUploadingHeroImage(false);
      e.target.value = "";
    }
  }

  async function saveBlog(publish: boolean) {
    const value = title.trim();
    const blocks = [description, ...extraBlocks];
    const desc = buildDescriptionWithHeadings(blocks);
    if (!value) {
      setSaveErr("Missing title");
      return;
    }
    const normalizedNewTitle = value.toLowerCase();
    if (myBlogs.some(blog => blog.title.toLowerCase() === normalizedNewTitle)) {
      setSaveErr("A blog with this title already exists.");
      return;
    }
    setSaving(true);
    setSaveErr(null);
    setSaveMsg(null);
    try {
      const { data } = await supabasePublic.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const mediaBody: {
        path: string;
        type: "image" | "video";
        published?: boolean;
        sortOrder?: number;
        title?: string | null;
        subtitle?: string | null;
        description?: string | null;
      }[] = [];
      if (heroImageUpload && heroImageUpload.path) {
        mediaBody.push({
          path: heroImageUpload.path,
          type: "image",
          published: true,
          sortOrder: mediaBody.length,
          title: "hero",
          subtitle: "hero"
        });
      }
      const sortedImages = [...imageUploads].sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        return a.position === "above" ? -1 : 1;
      });
      for (const img of sortedImages) {
        mediaBody.push({
          path: img.path,
          type: "image",
          published: true,
          sortOrder: mediaBody.length,
          title: String(img.index),
          subtitle: img.position
        });
      }
      const sortedVideos = [...videoUploads].sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        return a.position === "above" ? -1 : 1;
      });
      for (const v of sortedVideos) {
        mediaBody.push({
          path: v.path,
          type: "video",
          published: true,
          sortOrder: mediaBody.length,
          title: String(v.index),
          subtitle: v.position
        });
      }
      const body = {
        title: value,
        description: desc,
        author: postedBy,
        displayDate: dateText,
        category: blogOption,
        published: publish,
        media: mediaBody
      };
      const r = await fetch("/api/blog", {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      
      let j;
      const contentType = r.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        j = await r.json();
      }
      
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `Save failed with status ${r.status}`);
      }
      
      setPublished(publish);
      setSaveMsg(publish ? "Published successfully" : "Draft saved successfully");
    } catch (e: any) {
      setSaveErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!configRef.current) return;
      const target = e.target as Node;
      if (!configRef.current.contains(target) && (!iconMenuRef.current || !iconMenuRef.current.contains(target))) {
        if (
          !showSubHeadingConfig &&
          !showSubSubHeadingConfig &&
          !showLinkConfig &&
          !showImageConfig &&
          !showVideoConfig &&
          !showIconMenu
        ) {
          return;
        }
        setShowLinkConfig(false);
        setShowSubHeadingConfig(false);
        setShowSubSubHeadingConfig(false);
        setShowImageConfig(false);
        setShowVideoConfig(false);
        setShowIconMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSubHeadingConfig, showSubSubHeadingConfig, showLinkConfig, showImageConfig, showVideoConfig, showIconMenu]);

  const allBlocks = [description, ...extraBlocks];
  const displayDate = dateText || today;
  const fullDescription = "";
  const previewDescription = "";

  return (
    <div className="container pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <div className="mb-2">
            <div className="text-base font-semibold">New Blog</div>
            <div className="text-xs text-slate-600">Create a new blog post.</div>
          </div>

          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div className="space-y-2">
               <div className="text-sm font-semibold text-slate-800">Blog Option</div>
               <div className="flex flex-wrap gap-2">
                 {["Featured Projects", "Real Estate Insights", "Tips and Guides", "Travel Visit"].map((opt) => (
                   <button
                     key={opt}
                     type="button"
                     onClick={() => setBlogOption(opt)}
                     className={`px-3 py-1.5 rounded-full text-xs transition-all border ${
                       blogOption === opt
                         ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                         : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                     }`}
                   >
                     {opt}
                   </button>
                 ))}
               </div>
             </div>
          </div>

          <div id="tools-container" className="w-full" style={mounted && toolsLocked ? { height: 42 } : undefined}>
            <div
              className="mb-3 z-20 relative bg-white w-full"
              style={
                mounted && toolsLocked && toolsTop !== null && toolsBox
                  ? {
                      position: "fixed",
                      top: toolsTop,
                      left: toolsBox.left,
                      width: toolsBox.width,
                      zIndex: 20,
                      backgroundColor: "white"
                    }
                  : undefined
              }
            >
              <div
                id="blog-tools-bar"
                className="flex items-center justify-between px-4 py-2 whitespace-nowrap shadow-sm border rounded-md w-full overflow-x-auto no-scrollbar"
                style={{ backgroundColor: "#EFDCEC" }}
              >
                <div className="text-xs font-semibold text-slate-700 mr-4">Tools</div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors"
                    onClick={() => applyTool("bold")}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors"
                    onClick={() => applyTool("italic")}
                  >
                    /
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors flex items-center justify-center"
                    aria-label="Insert separator"
                    onClick={() => applyTool("separator")}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="4" y1="12" x2="20" y2="12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors"
                    onClick={() => {
                      let idx = activeBlockIndex === null ? 0 : activeBlockIndex + 1;
                      if (activeBlockIndex === null && description.trim() !== "") {
                        addTextBlock();
                        idx = extraBlocks.length + 1;
                      }
                      setHeadingIndex(idx);
                      setSubHeadingIndex(idx);
                      setSubSubHeadingIndex(idx);
                      setHeading(headings[idx] || "");
                      setSubHeading(subHeadings[idx] || "");
                      setSubSubHeading(subSubHeadings[idx] || "");
                      setShowSubHeadingConfig(true);
                      setShowSubSubHeadingConfig(true);
                      setTimeout(() => headingRef.current?.focus(), 100);
                    }}
                  >
                    Headings
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors flex items-center gap-1"
                      onClick={() => setShowIconMenu(!showIconMenu)}
                      aria-label="Text icon menu"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </button>
                    {showIconMenu && (
                      <div
                        ref={iconMenuRef}
                        className="absolute top-full right-0 mt-1 bg-white border rounded-md shadow-lg z-50 min-w-[280px] flex flex-col"
                      >
                        <div className="flex border-b overflow-x-auto no-scrollbar bg-slate-50 rounded-t-md p-1 gap-1">
                          {BLOG_ICON_CATEGORIES.map(cat => (
                            <button
                              key={cat.name}
                              type="button"
                              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors whitespace-nowrap ${
                                activeIconCategory === cat.name
                                  ? "bg-white text-blue-600 shadow-sm"
                                  : "text-slate-500 hover:bg-slate-100"
                              }`}
                              onClick={() => setActiveIconCategory(cat.name)}
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>
                        <div className="p-2 grid grid-cols-7 gap-1 max-h-[220px] overflow-y-auto custom-scrollbar">
                          {BLOG_ICON_CATEGORIES.find(c => c.name === activeIconCategory)?.icons.map(icon => (
                            <button
                              key={icon}
                              type="button"
                              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-lg transition-colors"
                              onClick={() => applyIcon(icon)}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs hover:bg-white/40 transition-colors"
                    onClick={() => applyTool("list")}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-white/40 transition-colors"
                    aria-label="Insert link"
                    onClick={openLinkConfig}
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
                      <path
                        d="M9.5 14.5L8 16a3 3 0 104.24 4.24l2-2A3 3 0 0013 12.5M14.5 9.5L16 8a3 3 0 10-4.24-4.24l-2 2A3 3 0 0011 11.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-white/40 transition-colors"
                    aria-label="Add text block"
                    onClick={addTextBlock}
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
                      <path
                        d="M5 6h14M9 10h10M9 14h7M9 18h5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M5 10h2M5 14h2M5 18h2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-white/40 transition-colors"
                    aria-label="Upload photo"
                    onClick={() => {
                      const idx = activeBlockIndex === null ? 0 : activeBlockIndex + 1;
                      const existing = imageAreas.find(a => a.index === idx);
                      const pos = existing ? existing.position : "above";
                      setImageConfigIndex(idx);
                      setImageConfigPosition(pos);
                      setImageAreas(prev => (existing ? prev : [...prev, { index: idx, position: pos }]));
                      setShowImageConfig(true);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
                      <path d="M4 7h3l1.5-2h7L17 7h3v11H4V7z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-xs flex items-center gap-1 hover:bg-white/40 transition-colors"
                    aria-label="Upload video"
                    onClick={() => {
                      const idx = activeBlockIndex === null ? 0 : activeBlockIndex + 1;
                      const existing = videoAreas.find(v => v.index === idx);
                      const pos = existing ? existing.position : "above";
                      setVideoConfigIndex(idx);
                      setVideoConfigPosition(pos);
                      setVideoAreas(prev => (existing ? prev : [...prev, { index: idx, position: pos }]));
                      setShowVideoConfig(true);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
                      <rect x="4" y="6" width="11" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <polygon points="16,9 20,11 20,13 16,15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <div ref={configRef}>
                {showLinkConfig && (
                  <div className="mt-3 flex flex-col gap-2 text-xs border border-gray-300 bg-white p-3 rounded-md shadow-sm">
                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch gap-2">
                      <div className="flex-1 min-w-[140px]">
                        <div className="mb-1 text-[10px] text-slate-600">URL</div>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          placeholder="https://example.com"
                          value={linkUrl}
                          onChange={e => setLinkUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <div className="mb-1 text-[10px] text-slate-600">Link text</div>
                        <input
                          type="text"
                          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          placeholder="Link text"
                          value={linkText}
                          onChange={e => setLinkText(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="px-2 py-1 rounded border text-[10px]" onClick={applyLinkFromConfig}>
                        Insert link
                      </button>
                      <button type="button" className="px-2 py-1 rounded border text-[10px]" onClick={() => setShowLinkConfig(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {showSubHeadingConfig && (
                  <div className="mt-3 flex flex-col gap-2 text-xs border border-gray-300 bg-white p-3 rounded-md shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        ref={headingInputRef}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Header"
                        value={heading}
                        onChange={e => {
                          const val = e.target.value;
                          setHeading(val);
                          setHeadings(prev => {
                            const next = prev.slice();
                            while (next.length <= headingIndex) next.push("");
                            next[headingIndex] = val;
                            return next;
                          });
                        }}
                      />
                      <div className="flex flex-col gap-1">
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          value={headingIndex}
                          onChange={e => {
                            const nextIndex = Number(e.target.value);
                            setHeadingIndex(nextIndex);
                            setHeading("");
                          }}
                        >
                          {allBlocks.map((_, idx) => (
                            <option key={idx} value={idx}>
                              {idx === 0 ? "Main description" : `Block ${idx}`}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-600">
                          Header will appear above: {headingIndex === 0 ? "Main description" : `Block ${headingIndex}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px]"
                        onClick={() => {
                          setHeadings(prev => {
                            const next = prev.slice();
                            if (headingIndex < next.length) next[headingIndex] = "";
                            return next;
                          });
                          setHeading("");
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        ref={subHeadingInputRef}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                        placeholder="Sub heading"
                        value={subHeading}
                        onChange={e => {
                          const val = e.target.value;
                          setSubHeading(val);
                          setSubHeadings(prev => {
                            const next = prev.slice();
                            while (next.length <= subHeadingIndex) next.push("");
                            next[subHeadingIndex] = val;
                            return next;
                          });
                        }}
                      />
                      <div className="flex flex-col gap-1">
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          value={subHeadingIndex}
                          onChange={e => {
                            const nextIndex = Number(e.target.value);
                            setSubHeadingIndex(nextIndex);
                            setHeading("");
                            setSubHeading("");
                          }}
                        >
                          {allBlocks.map((_, idx) => (
                            <option key={idx} value={idx}>
                              {idx === 0 ? "Main description" : `Block ${idx}`}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-600">
                          Header and sub headings will appear above: {subHeadingIndex === 0 ? "Main description" : `Block ${subHeadingIndex}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px]"
                        onClick={() => {
                          setSubHeadings(prev => {
                            const next = prev.slice();
                            if (subHeadingIndex < next.length) next[subHeadingIndex] = "";
                            return next;
                          });
                          setSubHeading("");
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    {showSubSubHeadingConfig && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                        type="text"
                        ref={subSubHeadingInputRef}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          placeholder="Sub sub heading"
                          value={subSubHeading}
                          onChange={e => {
                            const val = e.target.value;
                            setSubSubHeading(val);
                            setSubSubHeadings(prev => {
                              const next = prev.slice();
                              while (next.length <= subSubHeadingIndex) next.push("");
                              next[subSubHeadingIndex] = val;
                              return next;
                            });
                          }}
                        />
                        <div className="flex flex-col gap-1">
                          <select
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                            value={subSubHeadingIndex}
                            onChange={e => {
                              const nextIndex = Number(e.target.value);
                              setSubSubHeadingIndex(nextIndex);
                              setSubSubHeading("");
                            }}
                          >
                            {allBlocks.map((_, idx) => (
                              <option key={idx} value={idx}>
                                {idx === 0 ? "Main description" : `Block ${idx}`}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-slate-600">
                            Sub sub heading will appear above: {subSubHeadingIndex === 0 ? "Main description" : `Block ${subSubHeadingIndex}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-[10px]"
                          onClick={() => {
                            setSubSubHeadings(prev => {
                              const next = prev.slice();
                              if (subSubHeadingIndex < next.length) next[subSubHeadingIndex] = "";
                              return next;
                            });
                            setSubSubHeading("");
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {showImageConfig && imageConfigIndex !== null && (
                  <div className="mt-3 flex flex-col gap-2 text-xs border border-gray-300 bg-white p-3 rounded-md shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-20 h-12 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 gap-1">
                        <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
                          <path d="M12 16V8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path
                            d="M8.5 11.5L12 8l3.5 3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M6 18h12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span>Image area</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          value={imageConfigIndex}
                          onChange={e => {
                            const nextIdx = Number(e.target.value);
                            const fromIdx = imageConfigIndex;
                            setImageConfigIndex(nextIdx);
                            setImageAreas(prev => {
                              const base = fromIdx === null ? prev : prev.filter(a => a.index !== fromIdx);
                              const existing = base.find(a => a.index === nextIdx);
                              if (existing) return base;
                              return [...base, { index: nextIdx, position: imageConfigPosition }];
                            });
                            setShowImageConfig(false);
                          }}
                        >
                          {allBlocks.map((_, idx) => (
                            <option key={idx} value={idx}>
                              {idx === 0 ? "Main description" : `Block ${idx}`}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          value={imageConfigPosition}
                          onChange={e => {
                            const pos = e.target.value === "below" ? "below" : "above";
                            setImageConfigPosition(pos);
                            if (imageConfigIndex !== null) {
                              setImageAreas(prev => {
                                const filtered = prev.filter(a => a.index !== imageConfigIndex);
                                return [...filtered, { index: imageConfigIndex, position: pos }];
                              });
                            }
                          }}
                        >
                          <option value="above">Above text</option>
                          <option value="below">Below text</option>
                        </select>
                        <div className="text-[10px] text-slate-600">
                          Image will appear {imageConfigPosition} {imageConfigIndex === 0 ? "main description" : `block ${imageConfigIndex}`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {showVideoConfig && videoConfigIndex !== null && (
                  <div className="mt-3 flex flex-col gap-2 text-xs border border-gray-300 bg-white p-3 rounded-md shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-24 h-12 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500">
                        Video area
                      </div>
                      <div className="flex flex-col gap-1">
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          value={videoConfigIndex}
                          onChange={e => {
                            const nextIdx = Number(e.target.value);
                            const fromIdx = videoConfigIndex;
                            setVideoConfigIndex(nextIdx);
                            setVideoAreas(prev => {
                              const base = fromIdx === null ? prev : prev.filter(v => v.index !== fromIdx);
                              const existing = base.find(v => v.index === nextIdx);
                              if (existing) return base;
                              return [...base, { index: nextIdx, position: videoConfigPosition }];
                            });
                            setShowVideoConfig(false);
                          }}
                        >
                          {allBlocks.map((_, idx) => (
                            <option key={idx} value={idx}>
                              {idx === 0 ? "Main description" : `Block ${idx}`}
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                          value={videoConfigPosition}
                          onChange={e => {
                            const pos = e.target.value === "below" ? "below" : "above";
                            setVideoConfigPosition(pos);
                            if (videoConfigIndex !== null) {
                              setVideoAreas(prev => {
                                const filtered = prev.filter(v => v.index !== videoConfigIndex);
                                return [...filtered, { index: videoConfigIndex, position: pos }];
                              });
                            }
                          }}
                        >
                          <option value="above">Above text</option>
                          <option value="below">Below text</option>
                        </select>
                        <div className="text-[10px] text-slate-600">
                          Video will appear {videoConfigPosition} {videoConfigIndex === 0 ? "main description" : `block ${videoConfigIndex}`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-3" ref={cardRef}>
            <div>
              <div
                className="relative w-full h-32 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 gap-2 overflow-hidden cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (uploadingHeroImage) return;
                  const input = heroImageUploadInputRef.current;
                  if (input) {
                    input.value = "";
                    input.click();
                  }
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (uploadingHeroImage) return;
                    const input = heroImageUploadInputRef.current;
                    if (input) {
                      input.value = "";
                      input.click();
                    }
                  }
                }}
              >
                {heroImageUpload && (heroImageUpload.url || heroImageUpload.path) ? (
                  <Image
                    src={
                      heroImageUpload.url ||
                      `/api/image/proxy?path=${encodeURIComponent(heroImageUpload.path)}`
                    }
                    alt="Blog hero image"
                    fill
                    sizes="100vw"
                    className="object-cover rounded-md"
                    unoptimized
                  />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                      <path
                        d="M12 16V8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8.5 11.5L12 8l3.5 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6 18h12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>
                      {uploadingHeroImage
                        ? "Uploading hero image..."
                        : "Click to upload blog hero image"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-1">
              <input
                type="file"
                accept="image/*"
                ref={heroImageUploadInputRef}
                className="hidden"
                onChange={handleHeroImageFileChange}
              />
              {uploadError && (
                <div className="mt-1 text-[10px] text-red-600">{uploadError}</div>
              )}
              {uploadSuccess && (
                <div className="mt-1 text-[10px] text-green-600">{uploadSuccess}</div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">Blog Title</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                placeholder="Enter blog title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-800">Posted by</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                  placeholder="Author name"
                  value={postedBy}
                  onChange={e => setPostedBy(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-800">Date</label>
                <div className="relative">
                  <input
                    type="text"
                    className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-slate-200 outline-none transition-all ${
                      dateError ? "border-red-500" : "border-gray-200"
                    }`}
                    placeholder="MM/DD/YYYY"
                    value={dateText}
                    onChange={e => {
                      const val = formatDateInput(e.target.value);
                      setDateText(val);
                      if (!val) {
                        setDateError(null);
                      } else if (!isValidDateText(val)) {
                        setDateError("Invalid date");
                      } else {
                        setDateError(null);
                      }
                    }}
                    disabled={saving}
                  />
                  {dateError && (
                    <div className="absolute top-full left-0 mt-1 text-[10px] text-red-600 font-medium">
                      {dateError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              {imageAreas.some(a => a.index === 0 && a.position === "above") && (
                <div className="mt-1 mb-2 flex items-center justify-between gap-2">
                  <div
                    className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 gap-2 overflow-hidden cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => startImageUpload(0)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        startImageUpload(0);
                      }
                    }}
                  >
                    {(() => {
                      const upload = getImageUpload(0, "above");
                      if (upload && (upload.url || upload.path)) {
                        const src =
                          upload.url ||
                          `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                        return (
                          <div className="relative w-full h-full">
                            <Image
                              src={src}
                              alt="Image area for main description"
                              fill
                              sizes="100vw"
                              className="object-cover rounded-md"
                              unoptimized
                            />
                          </div>
                        );
                      }
                      return (
                        <>
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 16V8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8.5 11.5L12 8l3.5 3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M6 18h12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>Image area for main description</span>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border text-[10px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={
                      uploadingImageIndex === 0
                        ? "Uploading image"
                        : "Upload image to main description"
                    }
                    onClick={() => startImageUpload(0)}
                    disabled={uploadingImageIndex === 0}
                  >
                    {uploadingImageIndex === 0 ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="opacity-25"
                        />
                        <path
                          d="M21 12a9 9 0 01-9 9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="opacity-75"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 7h3l1.5-2h7L17 7h3v11H4V7z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                    onClick={() => removeImageArea(0)}
                  >
                    Remove
                  </button>
                </div>
              )}
              {videoAreas.some(v => v.index === 0 && v.position === "above") && (
                <div className="mt-1 mb-2 flex items-center justify-between gap-2">
                  <div
                    className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 gap-2 overflow-hidden cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => startVideoUpload(0)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        startVideoUpload(0);
                      }
                    }}
                  >
                    {(() => {
                      const upload = getVideoUpload(0, "above");
                      if (upload && (upload.url || upload.path)) {
                        const src =
                          upload.url ||
                          `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                        return (
                          <video
                            className="w-full h-full rounded-md object-cover"
                            src={src}
                            controls
                            controlsList="nodownload"
                          />
                        );
                      }
                      return (
                        <>
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 16V8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8.5 11.5L12 8l3.5 3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M6 18h12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>
                            {uploadingIndex === 0
                              ? "Uploading video..."
                              : "Video area for main description"}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border text-[10px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={
                      uploadingIndex === 0
                        ? "Uploading video"
                        : "Upload video to main description"
                    }
                    onClick={() => startVideoUpload(0)}
                    disabled={uploadingIndex === 0}
                  >
                    {uploadingIndex === 0 ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="opacity-25"
                        />
                        <path
                          d="M21 12a9 9 0 01-9 9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="opacity-75"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3 h-3"
                        aria-hidden="true"
                      >
                        <rect
                          x="4"
                          y="6"
                          width="11"
                          height="12"
                          rx="1.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <polygon
                          points="16,9 20,11 20,13 16,15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                    onClick={() => removeVideoArea(0)}
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="mt-1 flex flex-col gap-2">
                {headings[0] !== undefined && (
                  <div className="flex items-start gap-2">
                    <textarea
                      rows={1}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-base font-bold text-gray-900"
                      placeholder="Main Heading (H1)"
                      value={headings[0] || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setHeadings(prev => {
                          const next = [...prev];
                          setDescriptionHistory(history => {
                            const snapshot = {
                              text: description,
                              h1: prev[0] || "",
                              h2: subHeadings[0] || "",
                              h3: subSubHeadings[0] || ""
                            };
                            const nextHistory = [...history, snapshot];
                            return nextHistory.length > 10 ? nextHistory.slice(nextHistory.length - 10) : nextHistory;
                          });
                          next[0] = val;
                          return next;
                        });
                      }}
                      onFocus={() => setActiveBlockIndex(null)}
                      ref={headingIndex === 0 ? headingRef : null}
                    />
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        setHeadings(prev => {
                          const next = [...prev];
                          if (next.length > 0) next[0] = "";
                          return next;
                        });
                        if (headingIndex === 0) setHeading("");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {subHeadings[0] !== undefined && (
                  <div className="flex items-start gap-2">
                    <textarea
                      rows={1}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-800"
                      placeholder="Sub Heading (H2)"
                      value={subHeadings[0] || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setSubHeadings(prev => {
                          const next = [...prev];
                          setDescriptionHistory(history => {
                            const snapshot = {
                              text: description,
                              h1: headings[0] || "",
                              h2: prev[0] || "",
                              h3: subSubHeadings[0] || ""
                            };
                            const nextHistory = [...history, snapshot];
                            return nextHistory.length > 10 ? nextHistory.slice(nextHistory.length - 10) : nextHistory;
                          });
                          next[0] = val;
                          return next;
                        });
                      }}
                      onFocus={() => setActiveBlockIndex(null)}
                      ref={subHeadingIndex === 0 ? subHeadingRef : null}
                    />
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        setSubHeadings(prev => {
                          const next = [...prev];
                          if (next.length > 0) next[0] = "";
                          return next;
                        });
                        if (subHeadingIndex === 0) setSubHeading("");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {subSubHeadings[0] !== undefined && (
                  <div className="flex items-start gap-2">
                    <textarea
                      rows={1}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700"
                      placeholder="Sub Sub Heading (H3)"
                      value={subSubHeadings[0] || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setSubSubHeadings(prev => {
                          const next = [...prev];
                          setDescriptionHistory(history => {
                            const snapshot = {
                              text: description,
                              h1: headings[0] || "",
                              h2: subHeadings[0] || "",
                              h3: prev[0] || ""
                            };
                            const nextHistory = [...history, snapshot];
                            return nextHistory.length > 10 ? nextHistory.slice(nextHistory.length - 10) : nextHistory;
                          });
                          next[0] = val;
                          return next;
                        });
                      }}
                      onFocus={() => setActiveBlockIndex(null)}
                      ref={subSubHeadingIndex === 0 ? subSubHeadingRef : null}
                    />
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        setSubSubHeadings(prev => {
                          const next = [...prev];
                          if (next.length > 0) next[0] = "";
                          return next;
                        });
                        if (subSubHeadingIndex === 0) setSubSubHeading("");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <textarea
                    rows={6}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    placeholder="Write your blog content here"
                    value={description}
                    onChange={e => {
                      const val = e.target.value;
                      setDescription(prev => {
                        setDescriptionHistory(history => {
                          const snapshot = {
                            text: prev,
                            h1: headings[0] || "",
                            h2: subHeadings[0] || "",
                            h3: subSubHeadings[0] || ""
                          };
                          const next = [...history, snapshot];
                          return next.length > 10 ? next.slice(next.length - 10) : next;
                        });
                        return val;
                      });
                    }}
                    ref={descRef}
                    onFocus={() => setActiveBlockIndex(null)}
                    disabled={saving}
                  />
                  <div className="flex flex-col gap-1">
                    {getMediaPlaceholders(0).map((tag, idx) => (
                      <div
                        key={idx}
                        className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono cursor-copy hover:bg-slate-200"
                        title="Click to copy"
                        onClick={() => {
                          navigator.clipboard.writeText(tag);
                          setSaveMsg(`Copied ${tag}`);
                          setTimeout(() => setSaveMsg(null), 2000);
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                    {activeBlockIndex === null && descriptionHistory.length > 0 && (
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-xs flex items-center justify-center"
                        aria-label="Undo description"
                        onClick={undoDescription}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3 h-3"
                          aria-hidden="true"
                        >
                          <path
                            d="M7 7l-3 3 3 3M4 10h8a5 5 0 110 10H9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {imageAreas.some(a => a.index === 0 && a.position === "below") && (
                <div className="mt-2 mb-2 flex items-center justify-between gap-2">
                  <div
                    className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 gap-2 overflow-hidden cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => startImageUpload(0)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        startImageUpload(0);
                      }
                    }}
                  >
                    {(() => {
                      const upload = getImageUpload(0, "below");
                      if (upload && (upload.url || upload.path)) {
                        const src =
                          upload.url ||
                          `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                        return (
                          <div className="relative w-full h-full">
                            <Image
                              src={src}
                              alt="Image area for main description"
                              fill
                              sizes="100vw"
                              className="object-cover rounded-md"
                              unoptimized
                            />
                          </div>
                        );
                      }
                      return (
                        <>
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 16V8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8.5 11.5L12 8l3.5 3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M6 18h12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>Image area for main description</span>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border text-[10px]"
                    onClick={() => removeImageArea(0)}
                  >
                    Remove
                  </button>
                </div>
              )}
              {videoAreas.some(v => v.index === 0 && v.position === "below") && (
                <div className="mt-2 mb-2 flex items-center justify-between gap-2">
                  <div
                    className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 gap-2 overflow-hidden cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => startVideoUpload(0)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        startVideoUpload(0);
                      }
                    }}
                  >
                    {(() => {
                      const upload = getVideoUpload(0, "below");
                      if (upload && (upload.url || upload.path)) {
                        const src =
                          upload.url ||
                          `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                        return (
                          <video
                            className="w-full h-full rounded-md object-cover"
                            src={src}
                            controls
                            controlsList="nodownload"
                          />
                        );
                      }
                      return (
                        <>
                          <svg
                            viewBox="0 0 24 24"
                            className="w-4 h-4"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 16V8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8.5 11.5L12 8l3.5 3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M6 18h12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span>
                            {uploadingIndex === 0
                              ? "Uploading video..."
                              : "Video area for main description"}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border text-[10px]"
                    onClick={() => removeVideoArea(0)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            {extraBlocks.map((block, i) => (
                <div key={i} className="mt-2">
                  {imageAreas.some(a => a.index === i + 1 && a.position === "above") && (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div
                        className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 gap-2 overflow-hidden cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => startImageUpload(i + 1)}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startImageUpload(i + 1);
                          }
                        }}
                      >
                        {(() => {
                          const upload = getImageUpload(i + 1, "above");
                          if (upload && (upload.url || upload.path)) {
                            const src =
                              upload.url ||
                              `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                            return (
                              <div className="relative w-full h-full">
                                <Image
                                  src={src}
                                  alt={`Image area for block ${i + 1}`}
                                  fill
                                  sizes="100vw"
                                  className="object-cover rounded-md"
                                  unoptimized
                                />
                              </div>
                            );
                          }
                          return (
                            <>
                              <svg
                                viewBox="0 0 24 24"
                                className="w-4 h-4"
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 16V8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M8.5 11.5L12 8l3.5 3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 18h12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span>Image area for block {i + 1}</span>
                            </>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={
                          uploadingImageIndex === i + 1
                            ? `Uploading image for block ${i + 1}`
                            : `Upload image to block ${i + 1}`
                        }
                        onClick={() => startImageUpload(i + 1)}
                        disabled={uploadingImageIndex === i + 1}
                      >
                        {uploadingImageIndex === i + 1 ? (
                          <svg
                            viewBox="0 0 24 24"
                            className="w-3 h-3 animate-spin"
                            aria-hidden="true"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              className="opacity-25"
                            />
                            <path
                              d="M21 12a9 9 0 01-9 9"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              className="opacity-75"
                            />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            className="w-3 h-3"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 7h3l1.5-2h7L17 7h3v11H4V7z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => removeImageArea(i + 1)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {videoAreas.some(v => v.index === i + 1 && v.position === "above") && (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div
                        className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 gap-2 overflow-hidden cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => startVideoUpload(i + 1)}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startVideoUpload(i + 1);
                          }
                        }}
                      >
                        {(() => {
                          const upload = getVideoUpload(i + 1, "above");
                          if (upload && (upload.url || upload.path)) {
                            const src =
                              upload.url ||
                              `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                            return (
                              <video
                                className="w-full h-full rounded-md object-cover"
                                src={src}
                                controls
                                controlsList="nodownload"
                              />
                            );
                          }
                          return (
                            <>
                              <svg
                                viewBox="0 0 24 24"
                                className="w-4 h-4"
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 16V8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M8.5 11.5L12 8l3.5 3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 18h12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span>
                                {uploadingIndex === i + 1
                                  ? "Uploading video..."
                                  : `Video area for block ${i + 1}`}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={
                          uploadingIndex === i + 1
                            ? "Uploading video"
                            : `Upload video to block ${i + 1}`
                        }
                        onClick={() => startVideoUpload(i + 1)}
                        disabled={uploadingIndex === i + 1}
                      >
                        {uploadingIndex === i + 1 ? (
                          <svg
                            viewBox="0 0 24 24"
                            className="w-3 h-3 animate-spin"
                            aria-hidden="true"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              className="opacity-25"
                            />
                            <path
                              d="M21 12a9 9 0 01-9 9"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              className="opacity-75"
                            />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            className="w-3 h-3"
                            aria-hidden="true"
                          >
                            <rect
                              x="4"
                              y="6"
                              width="11"
                              height="12"
                              rx="1.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <polygon
                              points="16,9 20,11 20,13 16,15"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => removeVideoArea(i + 1)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {headings[i + 1] !== undefined && (
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={1}
                          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-base font-bold text-gray-900"
                          placeholder="Main Heading (H1)"
                          value={headings[i + 1] || ""}
                          onChange={e => {
                            const val = e.target.value;
                            setHeadings(prev => {
                              const next = [...prev];
                              while (next.length <= i + 1) next.push("");
                              setExtraHistory(prevHistory => {
                                const copy = prevHistory.map(arr => [...arr]);
                                if (!copy[i]) copy[i] = [];
                                const snapshot = {
                                  text: extraBlocks[i],
                                  h1: prev[i + 1] || "",
                                  h2: subHeadings[i + 1] || "",
                                  h3: subSubHeadings[i + 1] || ""
                                };
                                copy[i].push(snapshot);
                                if (copy[i].length > 10) {
                                  copy[i] = copy[i].slice(copy[i].length - 10);
                                }
                                return copy;
                              });
                              next[i + 1] = val;
                              return next;
                            });
                          }}
                          onFocus={() => setActiveBlockIndex(i)}
                          ref={headingIndex === i + 1 ? headingRef : null}
                        />
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => {
                            setHeadings(prev => {
                              const next = [...prev];
                              if (i + 1 < next.length) next[i + 1] = "";
                              return next;
                            });
                            if (headingIndex === i + 1) setHeading("");
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {subHeadings[i + 1] !== undefined && (
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={1}
                          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-800"
                          placeholder="Sub Heading (H2)"
                          value={subHeadings[i + 1] || ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubHeadings(prev => {
                              const next = [...prev];
                              while (next.length <= i + 1) next.push("");
                              setExtraHistory(prevHistory => {
                                const copy = prevHistory.map(arr => [...arr]);
                                if (!copy[i]) copy[i] = [];
                                const snapshot = {
                                  text: extraBlocks[i],
                                  h1: headings[i + 1] || "",
                                  h2: prev[i + 1] || "",
                                  h3: subSubHeadings[i + 1] || ""
                                };
                                copy[i].push(snapshot);
                                if (copy[i].length > 10) {
                                  copy[i] = copy[i].slice(copy[i].length - 10);
                                }
                                return copy;
                              });
                              next[i + 1] = val;
                              return next;
                            });
                          }}
                          onFocus={() => setActiveBlockIndex(i)}
                          ref={subHeadingIndex === i + 1 ? subHeadingRef : null}
                        />
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => {
                            setSubHeadings(prev => {
                              const next = [...prev];
                              if (i + 1 < next.length) next[i + 1] = "";
                              return next;
                            });
                            if (subHeadingIndex === i + 1) setSubHeading("");
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {subSubHeadings[i + 1] !== undefined && (
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={1}
                          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700"
                          placeholder="Sub Sub Heading (H3)"
                          value={subSubHeadings[i + 1] || ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubSubHeadings(prev => {
                              const next = [...prev];
                              while (next.length <= i + 1) next.push("");
                              setExtraHistory(prevHistory => {
                                const copy = prevHistory.map(arr => [...arr]);
                                if (!copy[i]) copy[i] = [];
                                const snapshot = {
                                  text: extraBlocks[i],
                                  h1: headings[i + 1] || "",
                                  h2: subHeadings[i + 1] || "",
                                  h3: prev[i + 1] || ""
                                };
                                copy[i].push(snapshot);
                                if (copy[i].length > 10) {
                                  copy[i] = copy[i].slice(copy[i].length - 10);
                                }
                                return copy;
                              });
                              next[i + 1] = val;
                              return next;
                            });
                          }}
                          onFocus={() => setActiveBlockIndex(i)}
                          ref={subSubHeadingIndex === i + 1 ? subSubHeadingRef : null}
                        />
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => {
                            setSubSubHeadings(prev => {
                              const next = [...prev];
                              if (i + 1 < next.length) next[i + 1] = "";
                              return next;
                            });
                            if (subSubHeadingIndex === i + 1) setSubSubHeading("");
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <textarea
                        rows={4}
                        className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        placeholder={`Additional text block ${i + 1}`}
                        value={block}
                        onChange={e => {
                          const val = e.target.value;
                          setExtraBlocks(prev =>
                            prev.map((b, idx) => {
                              if (idx === i) {
                                setExtraHistory(prevHistory => {
                                  const copy = prevHistory.map(arr => [...arr]);
                                  if (!copy[i]) copy[i] = [];
                                  const snapshot = {
                                    text: b,
                                    h1: headings[i + 1] || "",
                                    h2: subHeadings[i + 1] || "",
                                    h3: subSubHeadings[i + 1] || ""
                                  };
                                  copy[i].push(snapshot);
                                  if (copy[i].length > 10) {
                                    copy[i] = copy[i].slice(copy[i].length - 10);
                                  }
                                  return copy;
                                });
                                return val;
                              }
                              return b;
                            })
                          );
                        }}
                        onFocus={() => setActiveBlockIndex(i)}
                        ref={el => {
                          extraRefs.current[i] = el;
                        }}
                        disabled={saving}
                      />
                      <div className="flex flex-col gap-1">
                        {getMediaPlaceholders(i + 1).map((tag, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono cursor-copy hover:bg-slate-200"
                            title="Click to copy"
                            onClick={() => {
                              navigator.clipboard.writeText(tag);
                              setSaveMsg(`Copied ${tag}`);
                              setTimeout(() => setSaveMsg(null), 2000);
                            }}
                          >
                            {tag}
                          </div>
                        ))}
                        {activeBlockIndex === i && extraHistory[i] && extraHistory[i].length > 0 && (
                          <button
                            type="button"
                            className="px-2 py-1 rounded border text-xs flex items-center justify-center"
                            aria-label="Undo text block"
                            onClick={() => undoExtraBlock(i)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="w-3 h-3"
                              aria-hidden="true"
                            >
                              <path
                                d="M7 7l-3 3 3 3M4 10h8a5 5 0 110 10H9"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => removeTextBlock(i)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                  {imageAreas.some(a => a.index === i + 1 && a.position === "below") && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div
                        className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 gap-2 overflow-hidden cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => startImageUpload(i + 1)}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startImageUpload(i + 1);
                          }
                        }}
                      >
                        {(() => {
                          const upload = getImageUpload(i + 1, "below");
                          if (upload && (upload.url || upload.path)) {
                            const src =
                              upload.url ||
                              `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                            return (
                              <div className="relative w-full h-full">
                                <Image
                                  src={src}
                                  alt={`Image area for block ${i + 1}`}
                                  fill
                                  sizes="100vw"
                                  className="object-cover rounded-md"
                                  unoptimized
                                />
                              </div>
                            );
                          }
                          return (
                            <>
                              <svg
                                viewBox="0 0 24 24"
                                className="w-4 h-4"
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 16V8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M8.5 11.5L12 8l3.5 3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 18h12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span>Image area for block {i + 1}</span>
                            </>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px]"
                        onClick={() => removeImageArea(i + 1)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {videoAreas.some(v => v.index === i + 1 && v.position === "below") && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div
                        className="flex-1 h-24 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 gap-2 overflow-hidden cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => startVideoUpload(i + 1)}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startVideoUpload(i + 1);
                          }
                        }}
                      >
                        {(() => {
                          const upload = getVideoUpload(i + 1, "below");
                          if (upload && (upload.url || upload.path)) {
                            const src =
                              upload.url ||
                              `/api/image/proxy?path=${encodeURIComponent(upload.path)}`;
                            return (
                              <video
                                className="w-full h-full rounded-md object-cover"
                                src={src}
                                controls
                                controlsList="nodownload"
                              />
                            );
                          }
                          return (
                            <>
                              <svg
                                viewBox="0 0 24 24"
                                className="w-4 h-4"
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 16V8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M8.5 11.5L12 8l3.5 3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 18h12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span>
                                {uploadingIndex === i + 1
                                  ? "Uploading video..."
                                  : `Video area for block ${i + 1}`}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-[10px] text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => removeVideoArea(i + 1)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-3 border-t pt-3">
                <input
                  type="file"
                  accept="video/*"
                  ref={uploadInputRef}
                  className="hidden"
                  onChange={handleVideoFileChange}
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={imageUploadInputRef}
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                {/* Duplicate configRef removed */}
                {uploadError && (
                  <div className="mt-2 text-[10px] text-red-600">{uploadError}</div>
                )}
                {/* Duplicate config sections removed */}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                <div>
                  Current status: <span className="font-semibold">{published ? "Published" : "Draft"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md border border-slate-300 text-xs text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => saveBlog(false)}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    id="blog-publish-button"
                    type="button"
                    className="px-3 py-1 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => saveBlog(true)}
                    disabled={saving}
                  >
                    {saving ? "Publishing..." : "Published"}
                  </button>
                </div>
              </div>

              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">Blog Card</div>
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="text-[10px] text-blue-600 hover:underline font-medium"
                  >
                    Preview Entire Blog
                  </button>
                </div>
                <div className="relative mb-2 w-full h-32 rounded-md bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 overflow-hidden">
                  {heroImageUpload && (heroImageUpload.url || heroImageUpload.path) ? (
                    <Image
                      src={
                        heroImageUpload.url ||
                        `/api/image/proxy?path=${encodeURIComponent(heroImageUpload.path)}`
                      }
                      alt="Blog hero image preview"
                      fill
                      sizes="100vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span>Blog hero image</span>
                  )}
                </div>
                <div className="text-slate-900 font-semibold">{title || "Your blog title will appear here."}</div>
                <div className="text-slate-600">
                  Posted by {postedBy || "Author name"} on <span className="text-slate-500 text-[10px]">{displayDate}</span>
                </div>
                {allBlocks.map((text, idx) => (
                  <div key={idx} className="text-slate-600">
                    {imageAreas.some(a => a.index === idx && a.position === "above") && (
                      <div className="relative mb-1 w-full h-24 rounded-md bg-slate-200 flex items-center justify-center text-[9px] text-slate-500 overflow-hidden">
                        {(() => {
                          const upload = getImageUpload(idx, "above");
                          if (upload && (upload.url || upload.path)) {
                            return (
                              <Image
                                src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                alt={`Content image ${idx} preview`}
                                fill
                                sizes="100vw"
                                className="object-cover"
                                unoptimized
                              />
                            );
                          }
                          return <span>Image area</span>;
                        })()}
                      </div>
                    )}
                    {videoAreas.some(v => v.index === idx && v.position === "above") && (
                      <div className="relative mb-1 w-full h-24 rounded-md bg-slate-200 flex items-center justify-center text-[9px] text-slate-500 overflow-hidden">
                        {(() => {
                          const upload = getVideoUpload(idx, "above");
                          if (upload && (upload.url || upload.path)) {
                            return (
                              <video
                                src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                className="absolute inset-0 w-full h-full object-cover"
                                controls
                                controlsList="nodownload"
                              />
                            );
                          }
                          return <span>Video area</span>;
                        })()}
                      </div>
                    )}
                    {headings[idx] && <div className="text-[12px] font-semibold text-slate-900 mb-0.5">{headings[idx]}</div>}
                    {subHeadings[idx] && <div className="text-[11px] font-semibold text-slate-800 mb-0.5">{subHeadings[idx]}</div>}
                    {subSubHeadings[idx] && <div className="text-[10px] font-medium text-slate-700 mb-0.5">{subSubHeadings[idx]}</div>}
                    {text ? text.split("\n").map((line, lIdx) => (
                      <div key={lIdx}>
                        {renderInlineFormatting(line)}
                      </div>
                    )) : null}
                    {imageAreas.some(a => a.index === idx && a.position === "below") && (
                      <div className="relative mt-1 w-full h-24 rounded-md bg-slate-200 flex items-center justify-center text-[9px] text-slate-500 overflow-hidden">
                        {(() => {
                          const upload = getImageUpload(idx, "below");
                          if (upload && (upload.url || upload.path)) {
                            return (
                              <Image
                                src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                alt={`Content image ${idx} preview`}
                                fill
                                sizes="100vw"
                                className="object-cover"
                                unoptimized
                              />
                            );
                          }
                          return <span>Image area</span>;
                        })()}
                      </div>
                    )}
                    {videoAreas.some(v => v.index === idx && v.position === "below") && (
                      <div className="relative mt-1 w-full h-24 rounded-md bg-slate-200 flex items-center justify-center text-[9px] text-slate-500 overflow-hidden">
                        {(() => {
                          const upload = getVideoUpload(idx, "below");
                          if (upload && (upload.url || upload.path)) {
                            return (
                              <video
                                src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                className="absolute inset-0 w-full h-full object-cover"
                                controls
                                controlsList="nodownload"
                              />
                            );
                          }
                          return <span>Video area</span>;
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {saveMsg && <div className="mt-2 text-[10px] text-green-600">{saveMsg}</div>}
              {saveErr && (
                <div className="mt-1 text-xs text-red-600" aria-live="polite" aria-atomic="true">
                  {saveErr}
                </div>
              )}
            </div>
          </section>

          <aside className="lg:col-span-1 space-y-4">
            <div className="card p-4">
              <div className="text-sm font-semibold mb-2">My Blogs</div>
              {myBlogsLoading ? (
                <div className="text-xs text-slate-500">Loading...</div>
              ) : myBlogsErr ? (
                <div className="text-xs text-red-500">{myBlogsErr}</div>
              ) : myBlogs.length === 0 ? (
                <div className="text-xs text-slate-500">No blogs found.</div>
              ) : (
                <div className="space-y-2">
                  {myBlogs.map(blog => (
                    <div key={blog.id} className="flex flex-col gap-1 p-2 border rounded-md bg-slate-50">
                      <div className="text-xs font-medium truncate">{blog.title}</div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={blog.published ? "text-green-600" : "text-slate-500"}>{blog.published ? "Published" : "Draft"}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/blog/${blog.id}/edit`)}
                            className="text-blue-600 hover:underline"
                            disabled={actionBusyId === blog.id}
                          >
                            Edit
                          </button>
                          {!blog.published && (
                            <button onClick={() => publishExisting(blog.id)} className="text-green-600 hover:underline" disabled={actionBusyId === blog.id}>
                              {actionBusyId === blog.id ? "..." : "Publish"}
                            </button>
                          )}
                          <button onClick={() => deleteExisting(blog.id)} className="text-red-600 hover:underline" disabled={actionBusyId === blog.id}>
                            {actionBusyId === blog.id ? "..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {showPreview && (
          <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4 md:p-8 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl ring-1 ring-black/5">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Blog Preview</h3>
                  <p className="text-xs text-slate-500">How your blog will look when published</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-slate-50/30">
                <article className="max-w-3xl mx-auto py-12 px-6 md:px-10 bg-white shadow-sm my-8 rounded-xl border border-slate-100">
                  <header className="mb-10">
                    <div className="relative aspect-video w-full rounded-2xl bg-slate-100 overflow-hidden mb-8 shadow-inner border border-slate-100">
                      {heroImageUpload && (heroImageUpload.url || heroImageUpload.path) ? (
                        <Image
                          src={heroImageUpload.url || `/api/image/proxy?path=${encodeURIComponent(heroImageUpload.path)}`}
                          alt="Hero"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-300 italic">No hero image</div>
                      )}
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-6 tracking-tight">
                      {title || "Untitled Blog Post"}
                    </h1>
                    
                    <div className="flex items-center gap-4 text-slate-500 border-b border-slate-100 pb-8">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                        {postedBy ? postedBy.charAt(0).toUpperCase() : "A"}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{postedBy || "Anonymous"}</div>
                        <div className="text-xs">{displayDate} · 5 min read</div>
                      </div>
                    </div>
                  </header>

                  <div className="max-w-none">
                    {allBlocks.map((text, idx) => (
                      <div key={idx} className="mb-10 last:mb-0 group">
                        {imageAreas.some(a => a.index === idx && a.position === "above") && (
                          <div className="relative aspect-[16/9] w-full rounded-xl bg-slate-50 overflow-hidden mb-6 shadow-sm border border-slate-100">
                            {(() => {
                              const upload = getImageUpload(idx, "above");
                              if (upload && (upload.url || upload.path)) {
                                return (
                                  <Image
                                    src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                    alt="Content"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                );
                              }
                              return <div className="absolute inset-0 flex items-center justify-center text-slate-300">Image Area</div>;
                            })()}
                          </div>
                        )}
                        
                        {videoAreas.some(v => v.index === idx && v.position === "above") && (
                          <div className="relative aspect-video w-full rounded-xl bg-black overflow-hidden mb-6 shadow-lg">
                            {(() => {
                              const upload = getVideoUpload(idx, "above");
                              if (upload && (upload.url || upload.path)) {
                                return (
                                  <video
                                    src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                    className="absolute inset-0 w-full h-full object-contain"
                                    controls
                                    controlsList="nodownload"
                                  />
                                );
                              }
                              return <div className="absolute inset-0 flex items-center justify-center text-slate-500">Video Area</div>;
                            })()}
                          </div>
                        )}

                        {headings[idx] && (
                          <h2 className="text-3xl font-bold text-slate-900 mb-4 mt-8 tracking-tight">{headings[idx]}</h2>
                        )}
                        {subHeadings[idx] && (
                          <h3 className="text-2xl font-semibold text-slate-800 mb-3 mt-6 tracking-tight">{subHeadings[idx]}</h3>
                        )}
                        {subSubHeadings[idx] && (
                          <h4 className="text-xl font-medium text-slate-700 mb-3 mt-4 tracking-tight">{subSubHeadings[idx]}</h4>
                        )}

                        {text && (
                          <div className="text-slate-600 leading-relaxed text-lg space-y-4">
                            {text.split("\n").map((line, lIdx) => (
                              <div key={lIdx} className="first:mt-0">
                                {renderInlineFormatting(line)}
                              </div>
                            ))}
                          </div>
                        )}

                        {imageAreas.some(a => a.index === idx && a.position === "below") && (
                          <div className="relative aspect-[16/9] w-full rounded-xl bg-slate-50 overflow-hidden mt-6 shadow-sm border border-slate-100">
                            {(() => {
                              const upload = getImageUpload(idx, "below");
                              if (upload && (upload.url || upload.path)) {
                                return (
                                  <Image
                                    src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                    alt="Content"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                );
                              }
                              return <div className="absolute inset-0 flex items-center justify-center text-slate-300">Image Area</div>;
                            })()}
                          </div>
                        )}
                        
                        {videoAreas.some(v => v.index === idx && v.position === "below") && (
                          <div className="relative aspect-video w-full rounded-xl bg-black overflow-hidden mt-6 shadow-lg">
                            {(() => {
                              const upload = getVideoUpload(idx, "below");
                              if (upload && (upload.url || upload.path)) {
                                return (
                                  <video
                                    src={upload.url || `/api/image/proxy?path=${encodeURIComponent(upload.path)}`}
                                    className="absolute inset-0 w-full h-full object-contain"
                                    controls
                                    controlsList="nodownload"
                                  />
                                );
                              }
                              return <div className="absolute inset-0 flex items-center justify-center text-slate-500">Video Area</div>;
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <footer className="mt-16 pt-8 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Written By</div>
                        <div className="text-lg font-bold text-slate-900">{postedBy || "Anonymous Author"}</div>
                      </div>
                    </div>
                  </footer>
                </article>
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-6 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    saveBlog(published);
                  }}
                  className="px-6 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition-all active:scale-95"
                >
                  {published ? "Publish Blog" : "Save Draft"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
