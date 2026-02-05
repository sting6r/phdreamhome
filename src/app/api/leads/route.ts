import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (!text) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }
    const body = JSON.parse(text);
    const { name, email, phone } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Check if a lead with this email already exists
    const existingInquiry = await Promise.race([
      withRetry(() => prisma.inquiry.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          type: "AI Lead"
        },
        orderBy: {
          createdAt: 'desc'
        }
      })),
      timeout(5000)
    ]);

    if (existingInquiry) {
      return NextResponse.json({ 
        success: true, 
        inquiry: existingInquiry,
        alreadyExists: true 
      });
    }

    const inquiry = await Promise.race([
      withRetry(() => prisma.inquiry.create({
        data: {
          name,
          email,
          phone,
          message: "Lead captured from AI Agent contact form",
          status: "Pending",
          type: "AI Lead",
          subject: "AI Agent Lead",
        },
      })),
      timeout(5000)
    ]);

    return NextResponse.json({ success: true, inquiry });
  } catch (error) {
    console.error("Error saving lead:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
