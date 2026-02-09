import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { sendEmail } from "@lib/mailer";
import { supabaseAdmin } from "@lib/supabase";
export const runtime = "nodejs";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

const rateLimit = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_DURATION = 60 * 1000;
const MAX_REQUESTS_PER_DURATION = 5;

export async function POST(request: Request) {
  try {
    const { listingId } = await request.json();
    if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

    // Basic IP-based rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const now = Date.now();
    const client = rateLimit.get(ip) || { count: 0, lastReset: now };

    if (now - client.lastReset > RATE_LIMIT_DURATION) {
      client.count = 1;
      client.lastReset = now;
    } else {
      client.count++;
    }
    rateLimit.set(ip, client);

    if (client.count > MAX_REQUESTS_PER_DURATION) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const listing = await Promise.race([
      withRetry(() => prisma.listing.findUnique({
        where: { id: listingId },
        include: { user: { select: { email: true, name: true } } },
      })),
      timeout(5000)
    ]) as any;

    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    let to = listing.user?.email || null;
    if (!to && listing.userId) {
      const { data } = await (supabaseAdmin.auth as any).admin.getUserById(listing.userId);
      to = data?.user?.email || null;
    }
    if (!to) return NextResponse.json({ error: "Owner email unavailable" }, { status: 400 });

    const subject = `Inquiry about your listing: ${listing.title}`;
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111">
        <h2 style="margin:0 0 12px">New Inquiry</h2>
        <p style="margin:0 0 12px">A visitor is interested in your listing: <strong>${listing.title}</strong>.</p>
        <p style="margin:0 0 12px">Listing ID: ${listing.id}</p>
        <p style="margin:0 0 12px">You can reply directly to this email or contact them via your preferred method.</p>
      </div>
    `;
    const info = await sendEmail(to, subject, html);

    // Save inquiry to database for dashboard visibility
    try {
      const inquiryData = {
        name: "Interested Buyer",
        email: "visitor@example.com",
        phone: null,
        message: `Inquiry about listing: ${listing.title}`,
        status: "Pending",
        subject: `Listing Inquiry: ${listing.title}`,
        type: "Listing",
        listingId: listingId,
        recipientEmail: to
      };

      await Promise.race([
        withRetry(() => prisma.inquiry.create({
          data: inquiryData
        })),
        timeout(8000)
      ]);
    } catch (dbError) {
      console.error("Prisma failed to save listing inquiry, attempting Supabase fallback:", dbError);
      try {
        const { error: insertError } = await supabaseAdmin
          .from('Inquiry')
          .insert({
            name: "Interested Buyer",
            email: "visitor@example.com",
            phone: null,
            message: `Inquiry about listing: ${listing.title}`,
            status: "Pending",
            subject: `Listing Inquiry: ${listing.title}`,
            type: "Listing",
            listingId: listingId,
            recipientEmail: to
          });
        
        if (insertError) {
          console.error("Supabase fallback failed for listing inquiry:", insertError);
        }
      } catch (fallbackErr) {
        console.error("Supabase fallback exception:", fallbackErr);
      }
    }

    return NextResponse.json({ message: "Email sent successfully!", messageId: (info as any)?.messageId ?? null });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
