import { NextResponse } from "next/server";
import { supabaseAdmin } from "@lib/supabase";
import { sendEmail } from "@lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const email = (body.email || "").trim();

    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    // Generate magic link which works for login/verification without password
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    if (linkError) {
      console.error("Failed to generate verification link:", linkError);
      return NextResponse.json({ error: linkError.message || "Failed to generate link" }, { status: 400 });
    }

    const verificationLink = linkData.properties?.action_link || linkData.properties?.redirect_to || "";
    
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="margin:0 0 16px; font-size: 24px; font-weight: 600;">Verify your email</h2>
        <p style="margin:0 0 16px; font-size: 16px; line-height: 1.5;">Please click the button below to verify your email address and sign in to PhDreamHome.</p>
        <p style="margin:0 0 24px">
          <a href="${verificationLink}" style="background-color:#2563eb; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block; font-weight: 500;">Verify Email</a>
        </p>
        <div style="border-top: 1px solid #eee; padding-top: 16px;">
          <p style="margin:0 0 8px; font-size:12px; color:#666">If the button doesn't work, copy and paste this link:</p>
          <p style="margin:0 0 16px; font-size:12px; color:#666; word-break:break-all; font-family: monospace; background: #f5f5f5; padding: 8px; border-radius: 4px;">${verificationLink}</p>
          <p style="margin:0; font-size:12px; color:#999">If you did not request this, you can safely ignore this email.</p>
        </div>
      </div>
    `;
    
    try {
      await sendEmail(email, "Verify your email - PhDreamHome", html);
      
      // In development, return the link directly for easier testing
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ 
          ok: true, 
          message: "Verification email sent (check console)", 
          verificationLink 
        });
      }
      
      return NextResponse.json({ ok: true, message: "Verification email sent" });
    } catch (emailError: any) {
      console.error("Failed to send email via nodemailer:", emailError);
      return NextResponse.json({ error: "Failed to send email. Please try again later." }, { status: 500 });
    }

  } catch (err: any) {
    console.error("Resend verification error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
