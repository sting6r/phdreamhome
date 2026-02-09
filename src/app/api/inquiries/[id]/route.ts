import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { status, transcript } = body;

    console.log(`PATCH inquiry ${id}:`, { 
      hasStatus: !!status, 
      transcriptCount: Array.isArray(transcript) ? transcript.length : (transcript ? 1 : 0) 
    });

    // Check if transcript indicates a tour request or latest message
    let tourUpdate = {};
    let latestMessageUpdate = {};
    if (Array.isArray(transcript)) {
      const fullText = transcript.map(m => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.parts)) return m.parts.map((p: any) => p.text || '').join(' ');
        return '';
      }).join(" ").toLowerCase();
      const hasTourRequest = 
        fullText.includes("schedule a tour") || 
        fullText.includes("site viewing") || 
        fullText.includes("visit the property") ||
        fullText.includes("book a tour") ||
        fullText.includes("want to see the property");

      if (hasTourRequest) {
        tourUpdate = {
          type: "Tour",
          subject: "Tour Request from AI Agent"
        };
      }

      // Extract the last user message to update the main 'message' field
      const userMessages = transcript.filter(m => (m as any).role === "user");
      if (userMessages.length > 0) {
        const lastUserMsg = userMessages[userMessages.length - 1];
        let content = (lastUserMsg as any).content || "";
        
        // Handle parts if content is missing
        if (!content && Array.isArray((lastUserMsg as any).parts)) {
          content = (lastUserMsg as any).parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join(' ');
        }
        
        if (content) {
          latestMessageUpdate = {
            message: content.slice(0, 500) // Truncate if too long for display
          };
        }
      }
    }

    const data = { 
      ...(status !== undefined && { status }),
      ...(transcript !== undefined && { transcript }),
      ...tourUpdate,
      ...latestMessageUpdate
    };

    try {
      const updated = await Promise.race([
        withRetry(() => prisma.inquiry.update({
          where: { id },
          data
        })),
        timeout(8000)
      ]);
      return NextResponse.json(updated);
    } catch (dbError) {
      console.error(`Prisma PATCH inquiry ${id} failed, trying Supabase fallback:`, dbError);
      
      const { data: updated, error: sbError } = await supabaseAdmin
        .from('Inquiry')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (sbError) throw sbError;
      return NextResponse.json(updated);
    }
  } catch (err: any) {
    console.error(`Error PATCHing inquiry ${id}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    try {
      await Promise.race([
        withRetry(() => prisma.inquiry.delete({
          where: { id }
        })),
        timeout(8000)
      ]);
    } catch (dbError) {
      console.error(`Prisma DELETE inquiry ${id} failed, trying Supabase fallback:`, dbError);
      const { error: sbError } = await supabaseAdmin
        .from('Inquiry')
        .delete()
        .eq('id', id);
      
      if (sbError) throw sbError;
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(`Error deleting inquiry ${id}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
