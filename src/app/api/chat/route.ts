import { createUIMessageStreamResponse } from 'ai';

// Set the runtime to nodejs for child_process support
export const runtime = 'nodejs';
export const maxDuration = 30;

async function getPythonAIResponse(message: string, sessionId: string = "default_session") {
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
      signal: AbortSignal.timeout(15000) 
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error body");
      console.error(`[Chat API] FastAPI error (${response.status}) at ${apiUrl}:`, errorText);
      throw new Error(`AI Agent (${apiUrl}) responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error: any) {
    console.error("[Chat API] Connection Error:", {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    if (error.name === 'TimeoutError') {
      throw new Error("AI Agent request timed out. Please check if the service is awake.");
    }
    
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
    
    // Call the FastAPI server
    const reply = await getPythonAIResponse(userMessage, sessionId || "default_session");

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
