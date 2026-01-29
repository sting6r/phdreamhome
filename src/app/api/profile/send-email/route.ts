import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";
import { sendEmail } from "@lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("sb-access-token")?.value;
    if (!token) {
      const h = req.headers.get("authorization") || "";
      const m = h.match(/^Bearer\s+(.+)$/i);
      token = m?.[1] || undefined;
    }
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data } = await supabaseAdmin.auth.getUser(token);
    const userId = data.user?.id;
    const fallbackEmail = data.user?.email || undefined;
    if (!userId && !fallbackEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let to = fallbackEmail || null;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      to = user?.email || to;
    }
    if (!to) return NextResponse.json({ error: "No email on file" }, { status: 400 });

    const subject = "Hello from PhDreamHome";
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111">
        <h2 style="margin:0 0 12px">Profile Notification</h2>
        <p style="margin:0 0 12px">This email was triggered from your profile page.</p>
        <p style="margin:0 0 12px">If you did not request this, you can ignore it.</p>
      </div>
    `;
    const info = await sendEmail(to, subject, html);

    return NextResponse.json({ ok: true, messageId: (info as any)?.messageId ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
