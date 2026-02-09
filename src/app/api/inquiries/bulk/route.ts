import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function DELETE(req: Request) {
  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    try {
      await Promise.race([
        withRetry(() => prisma.inquiry.deleteMany({
          where: {
            id: { in: ids }
          }
        })),
        timeout(8000)
      ]);
    } catch (dbError) {
      console.error("Prisma bulk delete failed, trying Supabase fallback:", dbError);
      const { error: sbError } = await supabaseAdmin
        .from('Inquiry')
        .delete()
        .in('id', ids);
      
      if (sbError) throw sbError;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Bulk delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { ids, status } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    try {
      await Promise.race([
        withRetry(() => prisma.inquiry.updateMany({
          where: {
            id: { in: ids }
          },
          data: { status }
        })),
        timeout(8000)
      ]);
    } catch (dbError) {
      console.error("Prisma bulk update failed, trying Supabase fallback:", dbError);
      const { error: sbError } = await supabaseAdmin
        .from('Inquiry')
        .update({ status })
        .in('id', ids);
      
      if (sbError) throw sbError;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Bulk update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
