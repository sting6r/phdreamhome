import { NextResponse } from "next/server";
import { prisma } from "@lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body?.userId as string | undefined;
    const email = body?.email as string | undefined;
    const name = body?.name as string | undefined;
    const username = body?.username as string | undefined;
    const phone = body?.phone as string | undefined;
    if (!userId || !email) return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    const existingById = await prisma.user.findUnique({ where: { id: userId } });
    const conflict = email ? await prisma.user.findFirst({ where: { email } }) : null;
    const emailCreate = conflict && conflict.id !== userId ? undefined : email;
    await prisma.user.upsert({
      where: { id: userId },
      update: { name: name ?? undefined, username: username ?? undefined, phone: phone ?? undefined },
      create: { id: userId, email: emailCreate, name: name ?? undefined, username: username ?? undefined, phone: phone ?? undefined }
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error in sync-user API:", error);
    return NextResponse.json({ ok: false, error: "Failed to sync user" }, { status: 500 });
  }
}