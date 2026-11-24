import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";

const createSchema = z.object({
  positionMs: z.number().min(0),
  note: z.string().max(1000).default(""),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ consumableId: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { consumableId } = await context.params;
    const bookmarks = await auth.client.getBookmarks(consumableId);
    return NextResponse.json({ bookmarks });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ consumableId: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { consumableId } = await context.params;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz yer imi verisi." }, { status: 400 });
    }
    await auth.client.createBookmark(
      consumableId,
      parsed.data.positionMs,
      parsed.data.note,
    );
    const bookmarks = await auth.client.getBookmarks(consumableId);
    return NextResponse.json({ ok: true, bookmarks });
  } catch (err) {
    return handleApiError(err);
  }
}
