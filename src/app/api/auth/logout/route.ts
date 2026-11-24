import { NextResponse } from "next/server";
import { clearSessionCookie, clearStoredSession } from "@/lib/session";

export async function POST() {
  clearStoredSession();
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
