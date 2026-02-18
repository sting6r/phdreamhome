import { createUIMessageStreamResponse } from 'ai';

// Set the runtime to nodejs for child_process support
export const runtime = 'nodejs';
export const maxDuration = 30;

async function getGroqFallbackResponse(message: string, history: any[] = [], userData?: { name?: string; email?: string; phone?: string }, additionalContext?: string) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      throw new Error("GROQ_API_KEY is not set");
    }

    const userInfo = userData ? `
User Information (Already captured):
- Name: ${userData.name || 'Not provided'}
- Email: ${userData.email || 'Not provided'}
- Phone: ${userData.phone || 'Not provided'}
DO NOT ask the user for their name, email, or phone number again as they have already provided this in the initial form.
` : "";

    const contextInfo = additionalContext ? `
Additional Context from the website:
${additionalContext}
` : "";

    const systemPrompt = `
You are Kyuubi, a professional PhDreamHome AI Assistant.
${userInfo}
${contextInfo}
Your goals:
1. PRIVACY POLICY: Strictly do not disclose client information from sale records and rental records. Do not mention names, contact details, or specific financial terms of past or current clients/tenants.
2. Answer questions about property listings with enthusiasm.
3. STRICT INVENTORY POLICY: Only offer properties that are explicitly provided in the chat context or listing data. 
   - DO NOT invent, hallucinate, or assume any property details.
   - DO NOT provide links to external websites or example.com.
   - If a user asks for a property that you don't see in the provided context, politely inform them that you couldn't find it in our current inventory and offer to help them find something else from our available listings.
4. CURRENCY & LOCATION: Use the appropriate currency based on the property's location:
   - For Philippines: Use Philippine Peso (₱ or PHP).
   - For USA: Use US Dollars ($ or USD).
   - For UAE/Dubai: Use UAE Dirham (AED).
   - For Singapore: Use Singapore Dollars (S$ or SGD).
   Always format prices clearly (e.g., ₱15,000,000 or $500,000).
5. NO HALLUCINATIONS: If a user asks for a property, location, or price range that is NOT in the provided context, you MUST state that you don't have that specific inventory currently. DO NOT provide "general ranges" or "typical prices" for locations not in our database.
6. MEDIA HANDLING: You must provide images and videos in your responses using Markdown to support the client's needs:
   - For images: ![Title](image_url)
   - For videos: ![Title](video_url)
   - Always include at least one relevant image for each property you recommend.
7. AUTONOMY: You are a standalone assistant. You can handle the entire conversation flow yourself. 
8. PERSUASION: Be proactive. If a user seems interested, suggest a tour or provide a link to view the full listing.
9. Keep responses concise (under 3 sentences) to suit a chat bubble.
10. INTERACTIVE CHOICES: If you provide options, choices, or suggestions to the user, format them using [CHOICES] Option 1 | Option 2 [/CHOICES] at the end of your message. This will render as clickable buttons for the user.
   - ONLY use "Send Message", "Call Agent", or "Email Agent" when the user explicitly asks to contact someone or if you've already provided property details and they seem very interested. Do NOT show these buttons on every response.
   - Use "View Listings" when the user wants to see more properties.
   - Example: "Would you like to speak with an agent? [CHOICES] Send Message | Call Agent | Email Agent [/CHOICES]"
11. AGENT CONTACT CARD: If the user wants to contact an agent, see agent details, or speak with someone, you can display an interactive agent card using [AGENT_CARD] block.
    - Format: 
      [AGENT_CARD]
      Name: Del Adones Adlawan
      Role: REAL ESTATE AGENT
      PRC: 13123123
      DHSUD: HS-1231
      Phone: 09772838819
      Email: deladonesadlawan@gmail.com
       Listings: 5
              [/AGENT_CARD]
    - Use [PHONE_DISPLAY]09772838819[/PHONE_DISPLAY] if the user ONLY wants the contact number.
    - Use [EMAIL_DISPLAY]deladonesadlawan@gmail.com[/EMAIL_DISPLAY] if the user ONLY wants the email address.
    - Always offer this when user asks for "Call Agent", "Email Agent", or "Contact Us".
12. TOUR SCHEDULE FORM: If the user wants to "Schedule a Tour", "Book a Visit", or "See the property in person", you can display an interactive tour form using [TOUR_FORM] block.
    - Format:
      [TOUR_FORM]
      Property: [Property Name]
      [/TOUR_FORM]
    - Always offer this when user asks for a visit or tour.
13. ONLY REAL DATA: Every property you mention MUST have a link and an image from the provided context. If it doesn't have a link, it's not in our database—DO NOT MENTION IT. If you are unsure if a property is in the context, assume it is NOT.
Use the chat history and the provided listing context to provide personalized help.
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
      signal: AbortSignal.timeout(30000)
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

async function getPythonAIResponse(message: string, sessionId: string = "default_session", history: any[] = [], userData?: any, additionalContext?: string) {
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
    console.log(`[Chat API] Connecting to Python Agent at: ${apiUrl}`);

    // If there's additional context, append it to the message for the Python agent
    // but the Python agent usually handles its own context. However, to ensure
    // it sees the website data, we can inject it here as a system message or append to current message.
    const enrichedMessage = additionalContext ? `${message}\n\n[Website Context]:\n${additionalContext}` : message;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: enrichedMessage,
        session_id: sessionId,
        user_data: userData,
        history: history.slice(-5).map(m => ({
          role: m.role,
          content: m.content || (Array.isArray(m.parts) ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') : "")
        }))
      }),
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
    // If it's a connection error or timeout, we try the Groq fallback
    const isConnectionError = 
      error.message.includes("fetch failed") || 
      error.message.includes("ECONNREFUSED") || 
      error.name === 'TimeoutError';

    if (isConnectionError) {
      console.warn("[Chat API] Python Agent unreachable or timeout, falling back to direct Groq call...");
      return await getGroqFallbackResponse(message, history, userData, additionalContext);
    }

    console.error("[Chat API] Connection Error:", {
      message: error.message,
      name: error.name,
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
    const { messages, sessionId, userData, additionalContext } = await req.json();
    console.log("Chat API received messages:", messages?.length, "Session:", sessionId, "User:", userData?.name);

    const lastMessage = messages[messages.length - 1];
    let userMessage = lastMessage.content;
    let imageParts: any[] = [];
    
    // If content is empty or has parts, try to extract from parts (AI SDK 6.0+)
    if (lastMessage.parts) {
      userMessage = lastMessage.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
        
      imageParts = lastMessage.parts
        .filter((part: any) => part.type === 'image')
        .map((part: any) => ({
          type: "image_url",
          image_url: { url: part.image instanceof URL ? part.image.toString() : part.image }
        }));
    }
    
    if (!userMessage && imageParts.length === 0) {
      throw new Error("No message content found");
    }

    // If we have images, the message to Python should be structured
    let finalMessageForPython: any = userMessage;
    if (imageParts.length > 0) {
      finalMessageForPython = [
        { type: "text", text: userMessage || "Analyze this image." },
        ...imageParts
      ];
    }
    
    // Call the FastAPI server with history, user data and additional context
    let reply = await getPythonAIResponse(
      typeof finalMessageForPython === 'string' ? finalMessageForPython : JSON.stringify(finalMessageForPython), 
      sessionId || "default_session", 
      messages, 
      userData, 
      additionalContext
    );

    // If the reply contains raw Supabase paths (images: or videos:), sign them before sending to UI
    if (reply && (reply.includes("images:") || reply.includes("videos:"))) {
      try {
        const { createSignedUrl } = await import("@lib/supabase");
        // Regex to find patterns like ![Title](images:path) or just images:path in text
        const pathRegex = /(?:images|videos):[a-zA-Z0-9._\-/]+/g;
        const paths = reply.match(pathRegex);
        
        if (paths) {
          console.log(`[Chat API] Signing ${paths.length} media paths found in AI response`);
          for (const path of paths) {
            const signedUrl = await createSignedUrl(path);
            if (signedUrl) {
              // Replace all occurrences of this path with the signed URL
              reply = reply.split(path).join(signedUrl);
            }
          }
        }
      } catch (signErr) {
        console.error("[Chat API] Error signing media paths in reply:", signErr);
      }
    }

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
