import { NextResponse } from "next/server";
import { sendEmail } from "@lib/mailer";
import { prisma, withRetry } from "@lib/prisma";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const date = String(body?.date || "").trim();
    const time = String(body?.time || "").trim();
    const message = String(body?.message || "").trim();
    const listingId = body?.listingId;
    const listingTitle = body?.listingTitle;

    if (!email || !date || !time) {
      return NextResponse.json({ error: "Missing required fields (email, date, or time)" }, { status: 400 });
    }

    // Check for duplicate tour request by email
    const existingTour = await prisma.inquiry.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        type: "Tour"
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingTour) {
      return NextResponse.json({ 
        success: true, 
        message: "You have already submitted a tour request with this email.",
        alreadyExists: true 
      });
    }

    const user = (await Promise.race([
      withRetry(() => prisma.user.findFirst({ where: { listings: { some: {} } } })),
      timeout(5000)
    ]) || await Promise.race([
      withRetry(() => prisma.user.findFirst()),
      timeout(5000)
    ])) as any;
    const agentEmail = process.env.AGENT_EMAIL || user?.email || process.env.SMTP_FROM || email;
    const targetEmail = "deladonesadlawan@gmail.com";

    // Save tour request as an Inquiry with type "Tour"
    await Promise.race([
      withRetry(() => prisma.inquiry.create({
        data: {
          name,
          email,
          phone,
          message,
          status: "Pending",
          subject: `Tour Request: ${listingTitle || "Property"}`,
          listingId: listingId || null,
          recipientEmail: agentEmail,
          type: "Tour",
          tourDate: date,
          tourTime: time,
        }
      })),
      timeout(5000)
    ]);

    const subject = `New Tour Request - ${listingTitle || "Property"}`;
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111">
        <h2 style="margin:0 0 12px">New Tour Request</h2>
        <div style="margin:0 0 8px"><strong>Property:</strong> ${listingTitle || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Preferred Date:</strong> ${date}</div>
        <div style="margin:0 0 8px"><strong>Preferred Time:</strong> ${time}</div>
        <div style="margin:0 0 8px"><strong>Client Name:</strong> ${name || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Client Email:</strong> ${email}</div>
        <div style="margin:0 0 12px"><strong>Client Phone:</strong> ${phone || "N/A"}</div>
        <div style="margin:0 0 8px"><strong>Additional Notes:</strong></div>
        <div>${message.replace(/\n/g, "<br/>")}</div>
      </div>
    `;
    
    const agentInfo = await sendEmail(agentEmail, subject, html, email);

    // Also send notification to the specified email address
    if (targetEmail !== agentEmail) {
      await sendEmail(targetEmail, subject, html, email);
    }

    const confirmSubject = "Tour Request Received - PH Dream Home";
    const confirmHtml = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111">
        <h2 style="margin:0 0 12px">Tour Request Received</h2>
        <p style="margin:0 0 12px">We have received your request to schedule a tour for <strong>${listingTitle || "the property"}</strong>.</p>
        <p style="margin:0 0 12px">Our agent will contact you shortly to confirm the schedule.</p>
        <div style="margin:0 0 8px"><strong>Requested Date:</strong> ${date}</div>
        <div style="margin:0 0 8px"><strong>Requested Time:</strong> ${time}</div>
        <div style="margin:0 0 12px"><strong>Your Details:</strong> ${name} (${phone})</div>
      </div>
    `;

    const userInfo = await sendEmail(email, confirmSubject, confirmHtml);
    const dev = !process.env.SMTP_HOST;

    return NextResponse.json({ ok: true, dev });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
