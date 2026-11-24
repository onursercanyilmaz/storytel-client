import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json(
      { authenticated: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      authenticated: true,
      email: session.email,
      authMode: session.authMode,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
