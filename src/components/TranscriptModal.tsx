"use client";

import { useEffect, useState } from "react";
import { X, User, Bot } from "lucide-react";

interface Message {
  id: string;
  role: string;
  parts: Array<{ type: string; text: string }>;
  content?: string;
}

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: Message[];
  clientName: string;
  inquiryId: string;
}

export default function TranscriptModal({ isOpen, onClose, transcript, clientName, inquiryId }: TranscriptModalProps) {
  const [localTranscript, setLocalTranscript] = useState<Message[]>(Array.isArray(transcript) ? transcript : []);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalTranscript(Array.isArray(transcript) ? transcript : []);
  }, [transcript, isOpen]);

  const handleManualReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || saving) return;
    const newMessage: Message = {
      id: `owner-${Date.now()}`,
      role: "owner",
      content: trimmed,
      parts: [{ type: "text", text: trimmed }]
    };
    const updated = [...localTranscript, newMessage];
    setLocalTranscript(updated);
    setReplyText("");
    setSaving(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: updated }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error("Failed to save manual reply");
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      setLocalTranscript(localTranscript);
      setReplyText(trimmed);
      if (e.name === 'AbortError') {
        alert("Request timed out. Please try again.");
      } else {
        alert(e?.message || "Failed to save manual reply");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chat Transcript</h2>
            <p className="text-xs text-slate-500">Conversation with {clientName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {!localTranscript || localTranscript.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
              <p>No messages in this transcript.</p>
            </div>
          ) : (
            localTranscript.map((m, i) => (
              <div
                key={`${m.id}-${i}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                    m.role === "user"
                      ? "bg-purple-600 text-white rounded-tr-none"
                      : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 opacity-70">
                    {m.role === "user" || m.role === "owner" ? <User size={12} /> : <Bot size={12} />}
                    <span className="font-bold uppercase tracking-wider text-[10px]">
                      {m.role === "user" ? clientName : m.role === "owner" ? "Owner" : "AI Assistant"}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-sm">
                    {m.parts && Array.isArray(m.parts) && m.parts.length > 0 ? (
                      m.parts.map((part: any, i: number) => {
                        if (part.type === "text") {
                          return <span key={i}>{part.text}</span>;
                        }
                        if (part.type === "reasoning") {
                          return (
                            <div key={i} className="my-2 rounded bg-amber-50/50 p-2 text-xs italic border-l-2 border-amber-200 text-slate-600">
                              {part.text}
                            </div>
                          );
                        }
                        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                          return (
                            <div key={i} className="my-2 rounded bg-slate-100 p-2 text-[10px] italic text-slate-500">
                              [System: Assistant performed an action]
                            </div>
                          );
                        }
                        return null;
                      })
                    ) : (
                      <span>
                        {typeof (m as any).content === 'string' 
                          ? (m as any).content 
                          : Array.isArray((m as any).content)
                            ? (m as any).content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
                            : (m as any).text || ""
                        }
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-white flex items-center gap-3">
          {replyOpen ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Type a manual reply..."
              />
              <button
                onClick={handleManualReply}
                disabled={saving || !replyText.trim()}
                className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-60"
              >
                Send
              </button>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setReplyOpen((v) => !v)}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
            >
              Manual Reply
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
