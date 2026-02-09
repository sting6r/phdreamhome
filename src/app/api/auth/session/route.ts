import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Auth session parsed body:", body);
    
    const { access_token, refresh_token } = body;
    if (!access_token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    const headers = new Headers();
    const isProd = process.env.NODE_ENV === "production";
    headers.append(
      "Set-Cookie",
      `sb-access-token=${access_token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${isProd ? "; Secure" : ""}`
    );
    if (refresh_token) {
      headers.append(
        "Set-Cookie",
        `sb-refresh-token=${refresh_token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${isProd ? "; Secure" : ""}`
      );
    }
    return new NextResponse(JSON.stringify({ ok: true }), { headers });
  } catch (error: any) {
    console.error("Auth session error:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE() {
  const headers = new Headers();
  const isProd = process.env.NODE_ENV === "production";
  headers.append(
    "Set-Cookie",
    `sb-access-token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`
  );
  headers.append(
    "Set-Cookie",
    `sb-refresh-token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`
  );
  return new NextResponse(JSON.stringify({ ok: true }), { headers });
}

export async function GET() {
  return NextResponse.json({ session: null });
}
