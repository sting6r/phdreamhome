import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const userId = body?.userId as string | undefined;
    const email = body?.email as string | undefined;
    const name = body?.name as string | undefined;
    const username = body?.username as string | undefined;
    const phone = body?.phone as string | undefined;
    if (!userId || !email) return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    
    const result = await Promise.race([
      withRetry(async () => {
        const existingById = await prisma.user.findUnique({ where: { id: userId } });
        const conflict = email ? await prisma.user.findFirst({ where: { email } }) : null;
        const emailCreate = conflict && conflict.id !== userId ? undefined : email;
        
        return await prisma.user.upsert({
          where: { id: userId },
          update: { name: name ?? undefined, username: username ?? undefined, phone: phone ?? undefined },
          create: { id: userId, email: emailCreate, name: name ?? undefined, username: username ?? undefined, phone: phone ?? undefined }
        });
      }),
      timeout(15000)
    ]);

    return NextResponse.json({ ok: true, user: result });
  } catch (error: any) {
    console.error("Error in sync-user API:", error);
    return NextResponse.json({ ok: false, error: "Failed to sync user after retries" }, { status: 500 });
  }
}
