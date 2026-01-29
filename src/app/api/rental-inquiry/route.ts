import { NextResponse } from "next/server";
import { sendEmail } from "@lib/mailer";
import { prisma } from "@lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const message = String(body?.message || "").trim();
    const status = String(body?.status || "").trim();
    const topic = String(body?.subject || "").trim();
    const listingId = body?.listingId;

    if (!email || !message) return NextResponse.json({ error: "Missing email or message" }, { status: 400 });

    // Check for duplicate inquiry by email within General inquiries
    const existingInquiry = await prisma.inquiry.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        type: { not: "AI Lead" }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingInquiry) {
      return NextResponse.json({ 
        success: true, 
        message: "You have already submitted an inquiry with this email.",
        alreadyExists: true 
      });
    }

    const user = await prisma.user.findFirst({ where: { listings: { some: {} } } }) || await prisma.user.findFirst();
    const agentEmail = process.env.AGENT_EMAIL || user?.email || process.env.SMTP_FROM || email;

    // Save inquiry to database
    await prisma.inquiry.create({
      data: {
        name,
        email,
        phone,
        message,
        status: status || "Pending",
        subject: topic,
        listingId: listingId || null,
        recipientEmail: agentEmail
      }
    });

    const subject = topic ? `Rental Inquiry - ${topic}` : "Rental Inquiry";
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111">
        <h2 style="margin:0 0 12px">Rental Inquiry</h2>
        <div style="margin:0 0 8px"><strong>Subject:</strong> ${topic || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Status:</strong> ${status || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Name:</strong> ${name || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Email:</strong> ${email}</div>
        <div style="margin:0 0 12px"><strong>Phone:</strong> ${phone || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Message:</strong></div>
        <div>${message.replace(/\n/g, "<br/>")}</div>
      </div>
    `;
    const agentInfo = await sendEmail(agentEmail, subject, html, email);
    const confirmSubject = "Your Rental Inquiry Received";
    const confirmHtml = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111">
        <h2 style="margin:0 0 12px">Thank you for your inquiry</h2>
        <p style="margin:0 0 12px">We received your inquiry and will get back to you shortly.</p>
        <div style="margin:0 0 8px"><strong>Subject:</strong> ${topic || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Status:</strong> ${status || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Name:</strong> ${name || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Email:</strong> ${email}</div>
        <div style="margin:0 0 12px"><strong>Phone:</strong> ${phone || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Your Message:</strong></div>
        <div>${message.replace(/\n/g, "<br/>")}</div>
      </div>
    `;
    const userInfo = await sendEmail(email, confirmSubject, confirmHtml);
    const dev = !process.env.SMTP_HOST;
    return NextResponse.json({ ok: true, agentMessageId: (agentInfo as any)?.messageId ?? null, userMessageId: (userInfo as any)?.messageId ?? null, dev });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
