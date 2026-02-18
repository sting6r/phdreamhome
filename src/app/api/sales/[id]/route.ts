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

    const { listingId, clientName, clientAddress, clientEmail, clientMessenger, clientPhone, amount, status, salesCategory, saleDate, notes, rentalStartDate, rentalDueDate, paymentEntries, duesEntries, utilitiesEntries, depositConfig, roomNo, floor } = body;

    let nextNotes: string | undefined = undefined;
    const hasPayments = Array.isArray(paymentEntries);
    const hasDues = Array.isArray(duesEntries);
    const hasUtilities = Array.isArray(utilitiesEntries);
    const hasDeposits = depositConfig && typeof depositConfig === "object";
    const hasMeta = typeof roomNo === "string" || typeof floor === "string";
    if (hasPayments || hasDues || hasUtilities || hasDeposits || hasMeta) {
      let existingText = "";
      let existingPayments: any[] = [];
      let existingDues: any[] = [];
      let existingUtilities: any[] = [];
      let existingDeposits: any = undefined;
      let existingMeta: any = undefined;
      try {
        if (sale.notes) {
          const parsed = JSON.parse(sale.notes);
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.text === "string") existingText = parsed.text;
            if (Array.isArray(parsed.payments)) existingPayments = parsed.payments;
            if (Array.isArray(parsed.dues)) existingDues = parsed.dues;
            if (Array.isArray(parsed.utilities)) existingUtilities = parsed.utilities;
            if (parsed.deposits && typeof parsed.deposits === "object") existingDeposits = parsed.deposits;
            if (parsed.meta && typeof parsed.meta === "object") existingMeta = parsed.meta;
          }
        }
      } catch {}
      const sanitizeDeposits = (d: any) => {
        if (!d || typeof d !== "object") return undefined;
        const advM = Number(d.advanceMonths);
        const secM = Number(d.securityMonths);
        const advA = Number(d.advanceAmount);
        const secA = Number(d.securityAmount);
        const out: any = {};
        if (!Number.isNaN(advM) && advM >= 0) out.advanceMonths = advM;
        if (!Number.isNaN(secM) && secM >= 0) out.securityMonths = secM;
        if (!Number.isNaN(advA) && advA >= 0) out.advanceAmount = advA;
        if (!Number.isNaN(secA) && secA >= 0) out.securityAmount = secA;
        return Object.keys(out).length ? out : undefined;
      };
      const sanitizeMeta = (m: any) => {
        const out: any = {};
        if (typeof m?.roomNo === "string") out.roomNo = m.roomNo;
        if (typeof m?.floor === "string") out.floor = m.floor;
        return Object.keys(out).length ? out : undefined;
      };
      const obj: any = {
        text: existingText,
        payments: hasPayments ? paymentEntries : existingPayments,
        dues: hasDues ? duesEntries : existingDues,
        utilities: hasUtilities ? utilitiesEntries : existingUtilities,
        deposits: hasDeposits ? (sanitizeDeposits(depositConfig) ?? existingDeposits) : existingDeposits,
        meta: hasMeta ? (sanitizeMeta({ roomNo, floor }) ?? existingMeta) : existingMeta
      };
      // Remove undefined keys for cleanliness
      if (obj.deposits === undefined) delete obj.deposits;
      if (obj.meta === undefined) delete obj.meta;
      nextNotes = JSON.stringify(obj);
    } else if (typeof notes === "string") {
      let existingPayments: any[] = [];
      let existingDues: any[] = [];
      let existingUtilities: any[] = [];
      let existingDeposits: any = undefined;
      let existingMeta: any = undefined;
      try {
        if (sale.notes) {
          const parsed = JSON.parse(sale.notes);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.payments)) existingPayments = parsed.payments;
            if (Array.isArray(parsed.dues)) existingDues = parsed.dues;
            if (Array.isArray(parsed.utilities)) existingUtilities = parsed.utilities;
            if (parsed.deposits && typeof parsed.deposits === "object") existingDeposits = parsed.deposits;
            if (parsed.meta && typeof parsed.meta === "object") existingMeta = parsed.meta;
          }
        }
      } catch {}
      if (existingPayments.length || existingDues.length || existingUtilities.length || existingDeposits || existingMeta) {
        const sanitizeDeposits = (d: any) => {
          if (!d || typeof d !== "object") return undefined;
          const advM = Number(d.advanceMonths);
          const secM = Number(d.securityMonths);
          const advA = Number(d.advanceAmount);
          const secA = Number(d.securityAmount);
          const out: any = {};
          if (!Number.isNaN(advM) && advM >= 0) out.advanceMonths = advM;
          if (!Number.isNaN(secM) && secM >= 0) out.securityMonths = secM;
          if (!Number.isNaN(advA) && advA >= 0) out.advanceAmount = advA;
          if (!Number.isNaN(secA) && secA >= 0) out.securityAmount = secA;
          return Object.keys(out).length ? out : undefined;
        };
        const sanitizeMeta = (m: any) => {
          const out: any = {};
          if (typeof m?.roomNo === "string") out.roomNo = m.roomNo;
          if (typeof m?.floor === "string") out.floor = m.floor;
          return Object.keys(out).length ? out : undefined;
        };
        const merged: any = { text: notes, payments: existingPayments, dues: existingDues, utilities: existingUtilities };
        const dep = sanitizeDeposits(depositConfig) ?? existingDeposits;
        const meta = sanitizeMeta({ roomNo, floor }) ?? existingMeta;
        if (dep) merged.deposits = dep;
        if (meta) merged.meta = meta;
        nextNotes = JSON.stringify(merged);
      } else {
        nextNotes = notes;
      }
    }

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
        notes: nextNotes,
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
