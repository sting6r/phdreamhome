import { NextResponse } from "next/server";
import { prisma, withRetry } from "@lib/prisma";
import { cookies } from "next/headers";
import { supabaseAdmin, createSignedUrl } from "@lib/supabase";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("sb-access-token")?.value;
    console.log("Profile API: Fetching for token present:", !!token);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) {
      console.error("Profile API: Supabase auth error:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = data.user?.id;
    if (!userId) {
      console.warn("Profile API: No userId found in token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
          timeout(5000)
        ]);
      } catch (e) {
        console.warn("Prisma username check failed/timed out, falling back to Supabase", e);
        const { data: u } = await supabaseAdmin.from('User').select('id').eq('username', body.username).neq('id', userId).maybeSingle();
        exists = !!u;
      }
      if (exists) return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }

    if (body.email && body.email !== data.user?.email) {
      let emailExists;
      try {
        emailExists = await Promise.race([
          withRetry(() => prisma.user.findFirst({
            where: { email: body.email, NOT: { id: userId } }
          })),
          timeout(5000)
        ]);
      } catch (e) {
        console.warn("Prisma email check failed/timed out, falling back to Supabase", e);
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
        timeout(5000)
      ]);
    } catch (e) {
      console.warn("Prisma update failed/timed out, falling back to Supabase", e);
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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("sb-access-token")?.value;
    console.log("Profile API GET: Fetching for token present:", !!token);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) {
      console.error("Profile API GET: Supabase auth error:", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = data.user?.id;
    if (!userId) {
      console.warn("Profile API GET: No userId found in token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("Profile API GET: Found userId:", userId);
    
    let user, totalListings;
    try {
      const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
      const userTask = withRetry(() => prisma.user.findUnique({ where: { id: userId } }));
      const countTask = withRetry(() => prisma.listing.count({ where: { userId } }));
      [user, totalListings] = await Promise.race([
        Promise.all([userTask, countTask]),
        timeout(5000)
      ]) as [any, number];
      
      // If Prisma returns null (e.g. not found or sync issue), force fallback to Supabase
      if (!user) {
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

      user = userRes.data || null;
      totalListings = countRes.count || 0;
    }
    
    const signedTask = user?.image ? createSignedUrl(user.image) : Promise.resolve(null);
    const signed = await signedTask;

    // Construct proxy URL if user has an image path, otherwise use signed URL
    let imageUrl = user?.image 
      ? `/api/image/proxy?path=${encodeURIComponent(user.image)}` 
      : signed;
    
    return NextResponse.json({
      id: user?.id ?? null,
      name: user?.name ?? "",
      username: user?.username ?? "",
      email: user?.email ?? (data.user?.email ?? ""),
      address: user?.address ?? "",
      phone: user?.phone ?? "",
      image: user?.image ?? "",
      imageUrl: imageUrl ?? null,
      verified: Boolean(user?.emailVerified ?? null),
      totalListings,
      role: user?.role ?? "",
      licenseNo: user?.licenseNo ?? "",
      dhsudAccredNo: user?.dhsudAccredNo ?? "",
      facebook: user?.facebook ?? "",
      whatsapp: user?.whatsapp ?? "",
      viber: user?.viber ?? "",
      instagram: user?.instagram ?? "",
      telegram: user?.telegram ?? "",
      youtube: user?.youtube ?? "",
      twitter: user?.twitter ?? ""
    });
  } catch (error: any) {
    console.error("Error in profile GET API:", error);
    return NextResponse.json({ error: `Failed to fetch profile: ${error.message}` }, { status: 500 });
  }
}
