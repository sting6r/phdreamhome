import { createUIMessageStreamResponse } from 'ai';

// Set the runtime to nodejs for child_process support
export const runtime = 'nodejs';
export const maxDuration = 30;

async function getPythonAIResponse(message: string, sessionId: string = "default_session") {
  try {
    const pythonApiUrl = process.env.PYTHON_API_URL || "http://localhost:8000";
    const response = await fetch(`${pythonApiUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        session_id: sessionId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `FastAPI error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error: any) {
    console.error("Error calling FastAPI agent:", error);
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
