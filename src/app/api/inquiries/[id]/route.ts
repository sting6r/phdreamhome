import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const text = await req.text();
    if (!text) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }
    const body = JSON.parse(text);
    const { status, transcript } = body;

    console.log(`PATCH inquiry ${id}:`, { 
      hasStatus: !!status, 
      transcriptCount: Array.isArray(transcript) ? transcript.length : (transcript ? 1 : 0) 
    });

    const updated = await withRetry(() => prisma.inquiry.update({
      where: { id },
      data: { 
        ...(status !== undefined && { status }),
        ...(transcript !== undefined && { transcript })
      }
    }));

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error(`Error PATCHing inquiry ${id}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await Promise.race([
      withRetry(() => prisma.inquiry.delete({
        where: { id }
      })),
      timeout(5000)
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
