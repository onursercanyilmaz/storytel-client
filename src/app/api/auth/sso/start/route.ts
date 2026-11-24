import { NextResponse } from "next/server";
import { startGoogleSsoFlow } from "@/lib/sso-browser";

export async function POST() {
  try {
    const status = await startGoogleSsoFlow();
    return NextResponse.json({
      state: status.state,
      message: status.message,
      error: status.error,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "SSO başlatılamadı." },
      { status: 500 },
    );
  }
}
