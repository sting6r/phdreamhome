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
    // Determine target user (support admin impersonation by ?email=)
    const url = new URL(req.url);
    const emailParam = (url.searchParams.get("email") || "").trim();
    let targetUserId = authUser.id;
    let targetEmail = authUser.email || "";
    if (emailParam && emailParam !== targetEmail) {
      // Check caller admin role
      let callerRole: string | null = null;
      try {
        const caller = await withRetry(() => prisma.user.findUnique({ where: { id: authUser.id }, select: { role: true } }), 2, 500);
        callerRole = caller?.role ?? null;
      } catch {
        const { data } = await supabaseAdmin.from("User").select("role").eq("id", authUser.id).maybeSingle();
        callerRole = (data as any)?.role ?? null;
      }
      const isAdmin = (callerRole || "").toLowerCase().includes("admin");
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Resolve target user by email
      try {
        const t = await withRetry(() => prisma.user.findUnique({ where: { email: emailParam }, select: { id: true, email: true } }), 2, 500);
        if (t?.id) {
          targetUserId = t.id;
          targetEmail = t.email || emailParam;
        } else {
          const { data } = await supabaseAdmin.from("User").select("id,email").eq("email", emailParam).maybeSingle();
          if (!data?.id) return NextResponse.json({ error: "User not found" }, { status: 404 });
          targetUserId = data.id;
          targetEmail = data.email || emailParam;
        }
      } catch {
        const { data } = await supabaseAdmin.from("User").select("id,email").eq("email", emailParam).maybeSingle();
        if (!data?.id) return NextResponse.json({ error: "User not found" }, { status: 404 });
        targetUserId = data.id;
        targetEmail = data.email || emailParam;
      }
    }
    const userId = targetUserId;
    
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (body.email) body.email = body.email.trim();

    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));

    if (body.username) {
      let exists;
      try {
        exists = await Promise.race([
        withRetry(() => prisma.user.findFirst({
          where: { username: body.username, NOT: { id: userId } }
        }), 3, 1000),
        timeout(15000)
      ]);
    } catch (e) {
      console.warn("Prisma username check failed/timed out (15s), falling back to Supabase", e);
        const { data: u } = await supabaseAdmin.from('User').select('id').eq('username', body.username).neq('id', userId).maybeSingle();
        exists = !!u;
      }
      if (exists) return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }

    if (body.email && body.email.toLowerCase() !== targetEmail.toLowerCase()) {
      // console.log("Profile API: Email change detected from", targetEmail, "to", body.email);
      let emailExists;
      try {
        emailExists = await Promise.race([
        withRetry(() => prisma.user.findFirst({
          where: { 
            email: { equals: body.email, mode: 'insensitive' }, 
            NOT: { id: userId } 
          }
        }), 3, 1000),
        timeout(15000)
      ]);
    } catch (e) {
      console.warn("Prisma email check failed/timed out (15s), falling back to Supabase", e);
        const { data: u } = await supabaseAdmin.from('User').select('id').eq('email', body.email).neq('id', userId).maybeSingle();
        emailExists = u;
      }
      
      if (emailExists) {
        console.warn("Profile API: Email already taken by another user. ID:", (emailExists as any).id, "Email:", body.email);
        return NextResponse.json({ error: "Email already taken" }, { status: 409 });
      }

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

    const updateData: Record<string, any> = { 
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

      // If email is not changing (case-insensitive), don't update it to avoid spurious unique constraint errors
      // if the database has duplicate emails or case sensitivity issues.
      if (body.email && body.email.toLowerCase() === targetEmail.toLowerCase()) {
        delete updateData.email;
      }

      Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k]);
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: true });
    }

    try {
      await Promise.race([
        withRetry(() => prisma.user.update({
          where: { id: userId },
          data: updateData
        })),
        timeout(30000)
      ]);
    } catch (e) {
      console.warn("Prisma update failed/timed out (30s), falling back to Supabase", e);
      const upsertPayload = {
        id: userId,
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      const { error: upError } = await supabaseAdmin
        .from('User')
        .upsert(upsertPayload, { onConflict: 'id' });
      if (upError) {
        const msg = upError.message || "Database update failed";
        if (/User_email_key/i.test(msg) || /unique constraint.*User_email_key/i.test(msg) || /duplicate key value/i.test(msg)) {
          return NextResponse.json({ error: "Email already taken" }, { status: 409 });
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error in profile PUT API:", error);
    return NextResponse.json({ error: error?.message || "Failed to update profile" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // console.log("[profile-get] Starting request processing...");
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
    // Determine target user (support admin impersonation by ?email=)
    const url = new URL(req.url);
    const emailParam = (url.searchParams.get("email") || "").trim();
    let targetUserId = authUser.id;
    let effectiveAuthUser = authUser as any;
    if (emailParam && emailParam !== (authUser.email || "")) {
      // Check caller admin role
      let callerRole: string | null = null;
      try {
        const caller = await withRetry(() => prisma.user.findUnique({ where: { id: authUser.id }, select: { role: true } }), 2, 500);
        callerRole = caller?.role ?? null;
      } catch {
        const { data } = await supabaseAdmin.from("User").select("role").eq("id", authUser.id).maybeSingle();
        callerRole = (data as any)?.role ?? null;
      }
      const isAdmin = (callerRole || "").toLowerCase().includes("admin");
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Resolve target user by email
      try {
        const t = await withRetry(() => prisma.user.findUnique({ where: { email: emailParam }, select: { id: true } }), 2, 500);
        if (t?.id) {
          targetUserId = t.id;
        } else {
          const { data } = await supabaseAdmin.from("User").select("id").eq("email", emailParam).maybeSingle();
          if (!data?.id) return NextResponse.json({ error: "User not found" }, { status: 404 });
          targetUserId = data.id;
        }
      } catch {
        const { data } = await supabaseAdmin.from("User").select("id").eq("email", emailParam).maybeSingle();
        if (!data?.id) return NextResponse.json({ error: "User not found" }, { status: 404 });
        targetUserId = data.id;
      }
      // Load target auth user for fallback fields
      const targetAuth = await supabaseAdmin.auth.admin.getUserById(targetUserId).then(r => r.data?.user).catch(() => null);
      if (targetAuth) effectiveAuthUser = targetAuth;
    }
    const userId = targetUserId;
    // console.log("Profile API GET: Found userId:", userId);
    
    let dbUser, totalListings;
    try {
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
      const userTask = withRetry(() => prisma.user.findUnique({ where: { id: userId } }), 3, 1000);
      const countTask = withRetry(() => prisma.listing.count({ where: { userId } }), 3, 1000);
      const [resUser, resCount] = await Promise.race([
        Promise.all([userTask, countTask]),
        timeout(15000)
      ]) as [any, number];
      
      dbUser = resUser;
      totalListings = resCount;
      // console.log("[profile-get] Prisma fetch result - User found:", !!dbUser, "Listings count:", totalListings);

      if (!dbUser) {
        try {
          dbUser = await withRetry(() => prisma.user.upsert({
            where: { id: userId },
            update: {},
            create: {
              id: userId,
              email: authUser.email || undefined,
              name: (authUser.user_metadata as any)?.full_name || (authUser.user_metadata as any)?.name || undefined
            }
          }), 2, 500);
        } catch {}
        if (!dbUser) {
          throw new Error("User not found in Prisma, forcing fallback");
        }
      }
    } catch (dbError) {
      console.warn("Prisma failed or returned null, attempting Supabase fallback:", dbError);
      
      let userRes = await supabaseAdmin
        .from('User')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (!userRes.data) {
        const insertRes = await supabaseAdmin
          .from('User')
          .insert({
            id: userId,
            email: (effectiveAuthUser?.email as string) || null,
            name: ((effectiveAuthUser?.user_metadata as any)?.full_name || (effectiveAuthUser?.user_metadata as any)?.name) || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .select('*')
          .maybeSingle();
        if (!insertRes.error) {
          userRes = insertRes;
        }
      }
        
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
    // Prefer signed URL if available to avoid proxy issues with private buckets
    let imageUrl = signed || (dbUser?.image ? getProxyImageUrl(dbUser.image) : null);
    
    return NextResponse.json({
      id: dbUser?.id ?? null,
      name: dbUser?.name ?? ((effectiveAuthUser?.user_metadata as any)?.full_name || (effectiveAuthUser?.user_metadata as any)?.name || ""),
      username: dbUser?.username ?? "",
      email: dbUser?.email ?? (effectiveAuthUser?.email ?? ""),
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
