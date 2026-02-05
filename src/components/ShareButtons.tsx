"use client";
import { useState, useEffect } from "react";

export default function ShareButtons({ title, address }: { title?: string; address?: string }) {
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  const enc = encodeURIComponent(shareUrl || "");
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${enc}`;
  const tw = `https://twitter.com/intent/tweet?url=${enc}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function shareInstagram() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: title || "Check this out",
          text: address ? `${title || ""} ${address}`.trim() : title || "",
          url: shareUrl,
        });
        return;
      }
    } catch {}
    window.open("https://www.instagram.com/", "_blank");
  }

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-sm px-3 py-2 text-black pointer-events-auto w-fit">
      <div className="text-xs font-semibold tracking-wide mb-1">SHARE THIS</div>
      <div className="flex items-center gap-3 text-xs">
        <a
          href={fb}
          target="_blank"
          rel="noopener"
          className="group inline-flex items-center gap-1 text-sky-700 hover:text-sky-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 group-hover:shadow-[0_0_8px_rgba(59,130,246,0.6)]">
            <path d="M22 12a10 10 0 1 0-11.6 9.9v-7h-2.6V12h2.6V9.7c0-2.6 1.6-4 3.9-4 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12" />
          </svg>
          <span className="group-hover:underline group-hover:shadow-[0_0_6px_rgba(59,130,246,0.45)]">Facebook</span>
        </a>
        <button
          onClick={shareInstagram}
          className="group inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 group-hover:shadow-[0_0_8px_rgba(236,72,153,0.6)]">
            <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 4a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm5.5-3a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          </svg>
          <span className="group-hover:underline group-hover:shadow-[0_0_6px_rgba(236,72,153,0.45)]">Instagram</span>
        </button>
        <a
          href={tw}
          target="_blank"
          rel="noopener"
          className="group inline-flex items-center gap-1 text-black hover:text-slate-800 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 group-hover:shadow-[0_0_8px_rgba(51,65,85,0.6)]">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm6.7 6.4c.01.2.01.4.01.6 0 6.3-4.8 13.6-13.6 13.6-2.7 0-5.2-.8-7.4-2.2.4 0 .9.1 1.3.1 2.2 0 4.2-.7 5.8-2-2.1 0-3.9-1.4-4.6-3.2.3.1.6.1.9.1.4 0 .9-.1 1.3-.2-2.1-.4-3.7-2.3-3.7-4.6v-.1c.6.3 1.2.5 1.9.5-1.1-.8-1.8-2.1-1.8-3.6 0-.8.2-1.6.6-2.3 2.2 2.7 5.6 4.5 9.4 4.7-.1-.3-.1-.6-.1-.9 0-2.4 2-4.4 4.4-4.4 1.3 0 2.4.5 3.2 1.3.9-.2 1.7-.5 2.4-.9-.3.9-.9 1.6-1.6 2.1.8-.1 1.5-.3 2.2-.6-.5.8-1.2 1.5-1.9 2.1z" />
          </svg>
          <span className="group-hover:underline group-hover:shadow-[0_0_6px_rgba(51,65,85,0.45)]">Twitter</span>
        </a>
        <button
          onClick={copy}
          className="group inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 group-hover:shadow-[0_0_8px_rgba(30,41,59,0.6)]">
            <path d="M8 7h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
            <path d="M16 3H6a2 2 0 0 0-2 2v10" />
          </svg>
          <span className="group-hover:underline group-hover:shadow-[0_0_6px_rgba(30,41,59,0.45)]">
            {copied ? "Copied" : "Copy URL"}
          </span>
        </button>
      </div>
    </div>
  );
}
