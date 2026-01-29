import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";

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

    const updated = await prisma.inquiry.update({
      where: { id },
      data: { 
        ...(status !== undefined && { status }),
        ...(transcript !== undefined && { transcript })
      }
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error(`Error PATCHing inquiry ${id}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.inquiry.delete({
      where: { id }
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
