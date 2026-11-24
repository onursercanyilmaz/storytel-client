import { NextResponse } from "next/server";
import { cancelSsoFlow } from "@/lib/sso-browser";

export async function POST() {
  cancelSsoFlow();
  return NextResponse.json({ ok: true });
}
