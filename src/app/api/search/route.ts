import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ results: [] });
    }
    const results = await auth.client.searchCatalog(q);
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
