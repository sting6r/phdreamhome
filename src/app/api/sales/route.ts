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
        .select('*, listing:Listing(title)')
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
    const { listingId, clientName, clientAddress, clientEmail, clientMessenger, clientPhone, amount, status, salesCategory, saleDate, notes, rentalStartDate, rentalDueDate } = body;

    if (!clientName || !amount || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
          notes,
        }
      })),
      timeout(5000)
    ]) as any;

    return NextResponse.json(sale);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
