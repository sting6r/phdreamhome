import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@lib/supabase";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

async function getUserId(req: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get("sb-access-token")?.value;
  if (!token) {
    const h = req.headers.get("authorization") || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    token = m?.[1];
  }
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id || null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    
    // Ensure the sale belongs to the user
    const sale = await Promise.race([
      withRetry(() => prisma.sale.findUnique({ where: { id } })),
      timeout(5000)
    ]) as any;
    if (!sale || sale.userId !== userId) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const { listingId, clientName, clientAddress, clientEmail, clientMessenger, clientPhone, amount, status, salesCategory, saleDate, notes, rentalStartDate, rentalDueDate } = body;

    const updated = await Promise.race([
      withRetry(() => prisma.sale.update({
      where: { id },
      data: {
        listingId: listingId === "" ? null : listingId,
        clientName,
        clientAddress,
        clientEmail,
        clientMessenger,
        clientPhone,
        amount: amount ? parseFloat(amount) : undefined,
        status,
        salesCategory,
        saleDate: saleDate ? new Date(saleDate) : undefined,
        rentalStartDate: rentalStartDate ? new Date(rentalStartDate) : (rentalStartDate === "" ? null : undefined),
        rentalDueDate: rentalDueDate ? new Date(rentalDueDate) : (rentalDueDate === "" ? null : undefined),
        notes,
      }
    })),
    timeout(5000)
    ]);

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    
    // Ensure the sale belongs to the user
    const sale = await Promise.race([
      withRetry(() => prisma.sale.findUnique({ where: { id } })),
      timeout(5000)
    ]) as any;
    if (!sale || sale.userId !== userId) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    await Promise.race([
      withRetry(() => prisma.sale.delete({
      where: { id }
    })),
    timeout(5000)
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
