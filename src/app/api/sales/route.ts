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

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let sales: any[] = [];
    try {
      sales = await withRetry(() => prisma.sale.findMany({
        where: { userId },
        include: {
          listing: {
            select: {
              title: true,
              address: true,
              city: true,
              state: true,
              country: true,
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      }), 2, 500);
    } catch (prismaError) {
      console.warn("Prisma failed to fetch sales, attempting Supabase fallback:", prismaError);
      
      const { data, error: sbError } = await supabaseAdmin
        .from('Sale')
        .select('*, listing:Listing(title,address,city,state,country)')
        .eq('userId', userId)
        .order('createdAt', { ascending: false });

      if (sbError) throw sbError;
      sales = data || [];
    }

    return NextResponse.json(sales);
  } catch (err: any) {
    console.error("Sales API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { listingId, clientName, clientAddress, clientEmail, clientMessenger, clientPhone, amount, status, salesCategory, saleDate, notes, rentalStartDate, rentalDueDate, depositConfig, roomNo, floor } = body;

    if (!clientName || !amount || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Merge depositConfig and meta (roomNo/floor) into notes JSON if provided
    let nextNotes = notes;
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
    const dep = sanitizeDeposits(depositConfig);
    const meta = sanitizeMeta({ roomNo, floor });
    if (dep || meta) {
      let base: any = {};
      if (typeof notes === "string" && notes?.trim()) {
        try {
          const parsed = JSON.parse(notes);
          if (parsed && typeof parsed === "object") {
            base = parsed;
          } else {
            base = { text: notes };
          }
        } catch {
          base = { text: notes };
        }
      } else if (typeof notes === "string" && !notes?.trim()) {
        base = {};
      }
      if (dep) base.deposits = dep;
      if (meta) base.meta = meta;
      nextNotes = JSON.stringify(base);
    }

    const sale = await Promise.race([
      withRetry(() => prisma.sale.create({
        data: {
          userId,
          listingId: listingId || null,
          clientName,
          clientAddress,
          clientEmail,
          clientMessenger,
          clientPhone,
          amount: parseFloat(amount),
          status,
          salesCategory: salesCategory || "Sale",
          saleDate: saleDate ? new Date(saleDate) : undefined,
          rentalStartDate: rentalStartDate ? new Date(rentalStartDate) : null,
          rentalDueDate: rentalDueDate ? new Date(rentalDueDate) : null,
          notes: nextNotes,
        }
      })),
      timeout(5000)
    ]) as any;

    return NextResponse.json(sale);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
