import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";

import { supabaseAdmin } from "@lib/supabase";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function GET(req: Request) {
  return NextResponse.json({ message: "Leads API is active. Use POST to create a lead." });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Check if a lead with this name and email already exists
    let existingInquiry: any = null;
    try {
      existingInquiry = await Promise.race([
        withRetry(() => prisma.inquiry.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' },
            name: { equals: name, mode: 'insensitive' },
            type: "AI Lead"
          },
          orderBy: {
            createdAt: 'desc'
          }
        })),
        timeout(8000)
      ]);
    } catch (dbError) {
      console.error("Prisma check existing lead failed, trying Supabase fallback:", dbError);
      const { data, error } = await supabaseAdmin
        .from('Inquiry')
        .select('*')
        .ilike('email', email)
        .ilike('name', name)
        .eq('type', 'AI Lead')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && data) {
        existingInquiry = data;
      }
    }

    if (existingInquiry) {
      return NextResponse.json({ 
        success: true, 
        inquiry: existingInquiry,
        alreadyExists: true 
      });
    }

    let inquiry: any = null;
    const inquiryData = {
      name: name || "AI Lead",
      email,
      phone: phone || null,
      message: "Lead captured from AI Agent contact form",
      status: "Pending",
      type: "AI Lead",
      subject: "AI Agent Lead",
    };

    try {
      inquiry = await Promise.race([
        withRetry(() => prisma.inquiry.create({
          data: inquiryData,
        })),
        timeout(8000)
      ]);
    } catch (dbError) {
      console.error("Prisma create lead failed, trying Supabase fallback:", dbError);
      const { data, error } = await supabaseAdmin
        .from('Inquiry')
        .insert(inquiryData)
        .select()
        .single();
      
      if (!error && data) {
        inquiry = data;
      } else {
        throw error || new Error("Failed to save lead to both Prisma and Supabase");
      }
    }

    return NextResponse.json({ success: true, inquiry });
  } catch (error: any) {
    console.error("Error saving lead:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
