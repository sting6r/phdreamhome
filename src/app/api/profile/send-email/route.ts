import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";
import { sendEmail } from "@lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

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

    let body: any = {};
    try { body = await req.json(); } catch {}

    let to = body.email || fallbackEmail || null;
    let user = null;
    
    // Fetch user details to check current email status
    if (userId) {
      try {
        user = await Promise.race([
          withRetry(() => prisma.user.findUnique({ where: { id: userId } })),
          timeout(5000)
        ]) as any;
      } catch (e) {
        console.warn("Prisma timeout/error in send-email, attempting Supabase fallback", e);
        const { data } = await supabaseAdmin.from('User').select('email, email_confirmed_at').eq('id', userId).maybeSingle();
        user = data;
      }
      if (!to && user) to = user.email;
    }
    if (!to) return NextResponse.json({ error: "No email on file" }, { status: 400 });

    const subject = "Verify your email - PhDreamHome";
    
    // Generate verification link
    let verificationLink = "";
    
    // Determine the correct link type
    const isEmailChange = user?.email && to !== user.email;
    
    let linkResult;
    if (isEmailChange) {
      linkResult = await supabaseAdmin.auth.admin.generateLink({
        type: "email_change_new",
        email: user.email,
        newEmail: to,
      });
    } else {
      // Use magiclink for both unconfirmed and confirmed users to avoid password requirement
      linkResult = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: to,
      });
    }

    let { data: linkData, error: linkError } = linkResult;
    
    // If email_change_new failed, it might be because the change wasn't initiated yet.
    // Try to initiate the update, then generate the link again.
    if (linkError && isEmailChange && userId) {
      // console.log("Initial link generation failed, attempting to update user email first...");
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: to });
      
      if (updateError) {
         console.error("Failed to initiate email change:", updateError);
         return NextResponse.json({ error: "Failed to initiate email change: " + updateError.message }, { status: 400 });
      }
      
      // Retry generation
      const retry = await supabaseAdmin.auth.admin.generateLink({
        type: "email_change_new",
        email: user.email,
        newEmail: to,
      });
      linkData = retry.data;
      linkError = retry.error;
    }
    
    if (linkError) {
      console.error("Failed to generate link:", linkError);
      return NextResponse.json({ error: "Failed to generate verification link: " + linkError.message }, { status: 500 });
    }
    
    verificationLink = linkData.properties?.action_link || linkData.properties?.redirect_to || "";
    
    const actionText = isEmailChange ? "Verify New Email" : "Verify Email";
    const titleText = isEmailChange ? "Confirm your new email address" : "Verify your email";
    
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111">
        <h2 style="margin:0 0 12px">${titleText}</h2>
        <p style="margin:0 0 12px">Please click the button below to verify your email address.</p>
        <p style="margin:0 0 24px">
          <a href="${verificationLink}" style="background-color:#2563eb; color:white; padding:10px 20px; text-decoration:none; border-radius:6px; display:inline-block;">${actionText}</a>
        </p>
        <p style="margin:0 0 12px; font-size:12px; color:#666">If the button doesn't work, copy and paste this link:</p>
        <p style="margin:0 0 12px; font-size:12px; color:#666; word-break:break-all">${verificationLink}</p>
        <p style="margin:0 0 12px; font-size:12px; color:#666">If you did not request this, you can ignore it.</p>
      </div>
    `;
    
    try {
      const info = await sendEmail(to, subject, html);
      return NextResponse.json({ ok: true, messageId: (info as any)?.messageId ?? null });
    } catch (emailError: any) {
      console.error("Failed to send email via nodemailer:", emailError);
      return NextResponse.json({ error: "Failed to send email. Please try again later." }, { status: 500 });
    }
  } catch (err: any) {
    let msg = String(err?.message ?? err);
    if (msg === "Timeout") msg = "Request timed out, please try again";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
