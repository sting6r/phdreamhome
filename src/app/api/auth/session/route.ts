import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { access_token } = await req.json();
  if (!access_token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `sb-access-token=${access_token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
  );
  return new NextResponse(JSON.stringify({ ok: true }), { headers });
}

export async function DELETE() {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `sb-access-token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
  return new NextResponse(JSON.stringify({ ok: true }), { headers });
}

export async function GET() {
  // Return an empty object to satisfy NextAuth's useSession hook.
  // Returning null causes "Cannot convert undefined or null to object" on the client.
  return NextResponse.json({});
}