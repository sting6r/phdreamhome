"use client";

import { useState } from "react";

interface EmailOwnerButtonProps {
  listingId: string;
}

export default function EmailOwnerButton({ listingId }: EmailOwnerButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSendEmail = async () => {
    setIsSending(true);
    setMessage(null);
    setIsError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("/api/send-listing-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        setMessage("Email sent successfully!");
        setIsError(false);
        setTimeout(() => setMessage(null), 5000);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Failed to send email.");
        setIsError(true);
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        setMessage("Request timed out. Please try again.");
      } else {
        setMessage("An unexpected error occurred.");
      }
      setIsError(true);
      console.error("Error sending email:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSendEmail}
        className="btn-green w-full"
        disabled={isSending}
      >
        {isSending ? "Sending..." : "Email Owner"}
      </button>
      {message && (
        <p 
          className={`mt-2 text-sm cursor-pointer hover:opacity-70 transition-opacity ${isError ? "text-red-500" : "text-green-500"}`}
          onClick={() => setMessage(null)}
          title="Click to dismiss"
        >
          {message}
        </p>
      )}
    </div>
  );
}
