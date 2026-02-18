import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { cookies } from "next/headers";
import { supabaseAdmin, createSignedUrl } from "@lib/supabase";
import { getProxyImageUrl } from "@lib/image-utils";
import { createServerSideClient } from "@lib/supabase-server";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  try {
    const supabase = await createServerSideClient();
    let { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !authUser) {
      // Try fallback to manual token if createServerSideClient failed
      const cookieStore = await cookies();
      let token = cookieStore.get("sb-access-token")?.value;
      if (!token) {
        const h = req.headers.get("authorization") || "";
        const m = h.match(/^Bearer\s+(.+)$/i);
        token = m?.[1];
      }
      
      if (token) {
        const { data } = await supabaseAdmin.auth.getUser(token);
        authUser = data.user;
        if (authUser) userError = null;
      }
    }

    if (userError || !authUser) {
      if (userError?.name === 'AuthSessionMissingError') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      console.error("Profile API PUT: Auth error:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;
    console.log("Profile API: Found userId:", userId);
    const body = await req.json();
    if (body.email) body.email = body.email.trim();

    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

    if (body.username) {
      let exists;
      try {
        exists = await Promise.race([
        withRetry(() => prisma.user.findFirst({
          where: { username: body.username, NOT: { id: userId } }
        })),
        timeout(8000)
      ]);
    } catch (e) {
      console.warn("Prisma username check failed/timed out (8s), falling back to Supabase", e);
        const { data: u } = await supabaseAdmin.from('User').select('id').eq('username', body.username).neq('id', userId).maybeSingle();
        exists = !!u;
      }
      if (exists) return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }

    if (body.email && body.email !== authUser.email) {
      let emailExists;
      try {
        emailExists = await Promise.race([
        withRetry(() => prisma.user.findFirst({
          where: { email: body.email, NOT: { id: userId } }
        })),
        timeout(8000)
      ]);
    } catch (e) {
      console.warn("Prisma email check failed/timed out (8s), falling back to Supabase", e);
        const { data: u } = await supabaseAdmin.from('User').select('id').eq('email', body.email).neq('id', userId).maybeSingle();
        emailExists = !!u;
      }
      if (emailExists) return NextResponse.json({ error: "Email already taken" }, { status: 409 });

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: body.email });
      if (authError) {
        console.error("Supabase auth update error:", authError);
        let msg = authError.message;
        // Handle generic Supabase errors with more helpful messages
        if (msg === "Error updating user") {
          msg = "Failed to update email. This address may already be in use.";
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const updateData = { 
      name: body.name ?? undefined, 
      email: body.email ?? undefined,
      username: body.username ?? undefined, 
      image: body.image ?? undefined, 
      address: body.address ?? undefined, 
      phone: body.phone ?? undefined, 
      role: body.role ?? undefined, 
      licenseNo: body.licenseNo ?? undefined, 
      dhsudAccredNo: body.dhsudAccredNo ?? undefined, 
      facebook: body.facebook ?? undefined, 
      whatsapp: body.whatsapp ?? undefined, 
      viber: body.viber ?? undefined, 
      instagram: body.instagram ?? undefined, 
      telegram: body.telegram ?? undefined, 
      youtube: body.youtube ?? undefined, 
      twitter: body.twitter ?? undefined 
    };

    try {
      await Promise.race([
        withRetry(() => prisma.user.update({
          where: { id: userId },
          data: updateData
        })),
        timeout(10000)
      ]);
    } catch (e) {
      console.warn("Prisma update failed/timed out (10s), falling back to Supabase", e);
      const { error: upError } = await supabaseAdmin.from('User').update({
        ...updateData,
        updatedAt: new Date().toISOString()
      }).eq('id', userId);
      
      if (upError) throw upError;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error in profile PUT API:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSideClient();
    let { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

    if (userError || !authUser) {
      // Try fallback to manual token if createServerSideClient failed
      const cookieStore = await cookies();
      let token = cookieStore.get("sb-access-token")?.value;
      if (!token) {
        const h = req.headers.get("authorization") || "";
        const m = h.match(/^Bearer\s+(.+)$/i);
        token = m?.[1];
      }
      
      if (token) {
        const { data } = await supabaseAdmin.auth.getUser(token);
        authUser = data.user;
        if (authUser) userError = null;
      }
    }

    if (userError || !authUser) {
      if (userError?.name === 'AuthSessionMissingError') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      console.error("Profile API GET: Supabase auth error:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;
    console.log("Profile API GET: Found userId:", userId);
    
    let dbUser, totalListings;
    try {
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
      const userTask = withRetry(() => prisma.user.findUnique({ where: { id: userId } }));
      const countTask = withRetry(() => prisma.listing.count({ where: { userId } }));
      const [resUser, resCount] = await Promise.race([
        Promise.all([userTask, countTask]),
        timeout(10000)
      ]) as [any, number];
      
      dbUser = resUser;
      totalListings = resCount;

      // If Prisma returns null (e.g. not found or sync issue), force fallback to Supabase
      if (!dbUser) {
        throw new Error("User not found in Prisma, forcing fallback");
      }
    } catch (dbError) {
      console.warn("Prisma failed or returned null, attempting Supabase fallback:", dbError);
      
      const userRes = await supabaseAdmin
        .from('User')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      const countRes = await supabaseAdmin
        .from('Listing')
        .select('*', { count: 'exact', head: true })
        .eq('userId', userId);
        
      if (userRes.error) console.error("Supabase fallback user fetch error:", userRes.error);
      if (countRes.error) console.error("Supabase fallback count fetch error:", countRes.error);

      dbUser = userRes.data || null;
      totalListings = countRes.count || 0;
    }
    
    const signedTask = dbUser?.image ? createSignedUrl(dbUser.image) : Promise.resolve(null);
    const signed = await signedTask;

    // Construct proxy URL if user has an image path, otherwise use signed URL
    let imageUrl = dbUser?.image 
      ? getProxyImageUrl(dbUser.image) 
      : signed;
    
    return NextResponse.json({
      id: dbUser?.id ?? null,
      name: dbUser?.name ?? "",
      username: dbUser?.username ?? "",
      email: dbUser?.email ?? (dbUser?.email ?? ""),
      address: dbUser?.address ?? "",
      phone: dbUser?.phone ?? "",
      image: dbUser?.image ?? "",
      imageUrl: imageUrl ?? null,
      verified: Boolean(dbUser?.emailVerified ?? null),
      totalListings,
      role: dbUser?.role ?? "",
      licenseNo: dbUser?.licenseNo ?? "",
      dhsudAccredNo: dbUser?.dhsudAccredNo ?? "",
      facebook: dbUser?.facebook ?? "",
      whatsapp: dbUser?.whatsapp ?? "",
      viber: dbUser?.viber ?? "",
      instagram: dbUser?.instagram ?? "",
      telegram: dbUser?.telegram ?? "",
      youtube: dbUser?.youtube ?? "",
      twitter: dbUser?.twitter ?? ""
    });
  } catch (error: any) {
    console.error("Error in profile GET API:", error);
    return NextResponse.json({ error: `Failed to fetch profile: ${error.message}` }, { status: 500 });
  }
}
