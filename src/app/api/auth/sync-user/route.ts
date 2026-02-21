import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { supabaseAdmin } from "@lib/supabase";

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const userId = body?.userId as string | undefined;
    const email = body?.email as string | undefined;
    const name = body?.name as string | undefined;
    const username = body?.username as string | undefined;
    const phone = body?.phone as string | undefined;
    if (!userId || !email) return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
    
    let result;
    try {
      result = await Promise.race([
        withRetry(async () => {
          const existingById = await prisma.user.findUnique({ where: { id: userId } });
          const conflict = email ? await prisma.user.findFirst({ where: { email } }) : null;
          const emailCreate = conflict && conflict.id !== userId ? undefined : email;
          
          return await prisma.user.upsert({
            where: { id: userId },
            update: { name: name ?? undefined, username: username ?? undefined, phone: phone ?? undefined },
            create: { id: userId, email: emailCreate, name: name ?? undefined, username: username ?? undefined, phone: phone ?? undefined }
          });
        }, 3, 1000),
        timeout(15000)
      ]);
    } catch (dbError) {
      console.warn("Prisma sync-user failed/timed out (15s), attempting Supabase fallback:", dbError);
      
      // Fallback to Supabase Admin
      const { data: existingUser } = await supabaseAdmin.from('User').select('id').eq('id', userId).single();
      
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };
      if (name) updateData.name = name;
      if (username) updateData.username = username;
      if (phone) updateData.phone = phone;
      
      if (existingUser) {
        const { data, error } = await supabaseAdmin.from('User').update(updateData).eq('id', userId).select().single();
        if (error) throw error;
        result = data;
      } else {
        const insertData = {
          id: userId,
          email: email,
          ...updateData,
          createdAt: new Date().toISOString()
        };
        const { data, error } = await supabaseAdmin.from('User').insert(insertData).select().single();
        if (error) throw error;
        result = data;
      }
    }

    return NextResponse.json({ ok: true, user: result });
  } catch (error: any) {
    console.error("Error in sync-user API:", error);
    return NextResponse.json({ ok: false, error: "Failed to sync user after retries" }, { status: 500 });
  }
}
