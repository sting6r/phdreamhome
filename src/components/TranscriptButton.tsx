"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import TranscriptModal from "./TranscriptModal";

interface TranscriptButtonProps {
  transcript: any;
  clientName: string;
  inquiryId: string;
}

export default function TranscriptButton({ transcript, clientName, inquiryId }: TranscriptButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse transcript if it's a string
  let messages = transcript;
  if (typeof transcript === 'string') {
    try {
      messages = JSON.parse(transcript);
    } catch (e) {
      console.error("Failed to parse transcript string:", e);
      messages = [];
    }
  }
  
  console.log("TranscriptButton data:", { 
    rawType: typeof transcript, 
    isRawArray: Array.isArray(transcript),
    parsedType: typeof messages,
    isParsedArray: Array.isArray(messages)
  });
  
  // Handle case where it's an object with a messages property
  if (messages && !Array.isArray(messages) && messages.messages) {
    messages = messages.messages;
  }
  
  // Ensure it's an array
  const finalTranscript = Array.isArray(messages) ? messages : [];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-xs font-semibold border border-purple-100"
        title="View Full Chat Transcript"
      >
        <MessageSquare size={14} />
        <span>Transcript</span>
      </button>

      <TranscriptModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        transcript={finalTranscript}
        clientName={clientName}
        inquiryId={inquiryId}
      />
    </>
  );
}
