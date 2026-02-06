import { createUIMessageStreamResponse } from 'ai';

// Set the runtime to nodejs for child_process support
export const runtime = 'nodejs';
export const maxDuration = 30;

async function getGroqFallbackResponse(message: string, history: any[] = []) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error("GROQ_API_KEY is not set");
    }

    const systemPrompt = `
You are Kyuubi, a professional PhDreamHome AI Assistant.
Your goals:
1. Answer questions about property listings with enthusiasm.
2. If a user asks about a specific price or location, provide helpful general ranges if data isn't provided.
3. IMPORTANT: Always try to capture the user's name or contact info to "schedule a viewing."
4. MEDIA HANDLING: You can provide images and videos in your responses using Markdown:
   - For images: ![Title](image_url)
   - For videos: ![Title](video_url) (The system will automatically detect video formats)
   - If you see a video link in the context, always try to show it to the user.
5. AUTONOMY: You are a standalone assistant. You can handle the entire conversation flow yourself. 
6. PERSUASION: Be proactive. If a user seems interested, suggest a tour or ask for their preferred contact method.
7. Keep responses concise (under 3 sentences) to suit a chat bubble.
Use the chat history to provide personalized help.
`;

    // Filter history to exclude the current message and limit to last 5 for context
    // IMPORTANT: Strip extra properties like 'id' which Groq doesn't support
    const recentHistory = history
      .filter(m => m.content !== message)
      .slice(-5)
      .map(m => ({
        role: m.role,
        content: m.content || (Array.isArray(m.parts) ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') : "")
      }));

    const messagesToSend = [
      { role: "system", content: systemPrompt },
      ...recentHistory,
      { role: "user", content: message }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messagesToSend,
        temperature: 0.2,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("[Chat API] Groq Fallback Error:", error.message);
    throw error;
  }
}

async function getPythonAIResponse(message: string, sessionId: string = "default_session", history: any[] = []) {
  try {
    let baseUrl = (process.env.PYTHON_API_URL || "http://localhost:8000").trim();
    
    if (!baseUrl) {
      baseUrl = "http://localhost:8000";
    }

    // Remove trailing slashes and /chat suffix to normalize
    baseUrl = baseUrl.replace(/\/+$/, "").replace(/\/chat$/, "");

    // Ensure the URL has a protocol
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      // For localhost, default to http, otherwise https
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = `http://${baseUrl}`;
      } else {
        baseUrl = `https://${baseUrl}`;
      }
    }

    const apiUrl = `${baseUrl}/chat`;
    console.log(`[Chat API] Connecting to: ${apiUrl} (ENV: ${process.env.NODE_ENV})`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        session_id: sessionId
      }),
      // Add a timeout to avoid hanging requests
      signal: AbortSignal.timeout(5000) // Shorter timeout for primary check
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error body");
      console.error(`[Chat API] FastAPI error (${response.status}) at ${apiUrl}:`, errorText);
      throw new Error(`AI Agent (${apiUrl}) responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error: any) {
    // If it's a connection error or timeout, we try the Groq fallback
    const isConnectionError = 
      error.message.includes("fetch failed") || 
      error.message.includes("ECONNREFUSED") || 
      error.name === 'TimeoutError';

    if (isConnectionError) {
      console.warn("[Chat API] Python Agent unreachable, falling back to direct Groq call...");
      return await getGroqFallbackResponse(message, history);
    }

    console.error("[Chat API] Connection Error:", {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    throw new Error(`AI Agent connection failed: ${error.message}`);
  }
}

export async function GET() {
  try {
    const hasGroq = !!process.env.GROQ_API_KEY;
    const provider = "FastAPI-Groq";
    const model = "llama-3.3-70b-versatile";
    return new Response(JSON.stringify({ provider, model }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json();
    console.log("Chat API received messages:", messages?.length, "Session:", sessionId);

    const lastMessage = messages[messages.length - 1];
    let userMessage = lastMessage.content;
    
    // If content is empty, try to extract from parts (AI SDK 6.0+)
    if (!userMessage && lastMessage.parts) {
      userMessage = lastMessage.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    }
    
    if (!userMessage) {
      throw new Error("No message content found");
    }
    
    // Call the FastAPI server with history
    const reply = await getPythonAIResponse(userMessage, sessionId || "default_session", messages);

    const messageId = `assistant-${Date.now()}`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "text-start", id: messageId });
        if (reply) {
          controller.enqueue({ type: "text-delta", id: messageId, delta: reply });
        }
        controller.enqueue({ type: "text-end", id: messageId });
        controller.close();
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
