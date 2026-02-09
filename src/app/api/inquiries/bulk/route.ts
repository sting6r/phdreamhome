import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function DELETE(req: Request) {
  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    await Promise.race([
      withRetry(() => prisma.inquiry.deleteMany({
        where: {
          id: { in: ids }
        }
      })),
      timeout(8000)
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { ids, status } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await Promise.race([
      withRetry(() => prisma.inquiry.updateMany({
        where: {
          id: { in: ids }
        },
        data: { status }
      })),
      timeout(8000)
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
