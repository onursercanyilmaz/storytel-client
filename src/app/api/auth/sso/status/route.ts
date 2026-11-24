import { NextResponse } from "next/server";
import { getSsoStatus } from "@/lib/sso-browser";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getSsoStatus();
  if (status.state === "success" && status.sid) {
    await setSessionCookie(status.sid);
  }
  return NextResponse.json(
    {
      state: status.state,
      message: status.message,
      email: status.email,
      error: status.error,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
