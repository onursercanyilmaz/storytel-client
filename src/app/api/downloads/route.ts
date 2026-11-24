import { NextResponse } from "next/server";
import { requireStorytelClient } from "@/lib/api-helpers";
import { listDownloads } from "@/lib/downloads";

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  return NextResponse.json(listDownloads());
}
