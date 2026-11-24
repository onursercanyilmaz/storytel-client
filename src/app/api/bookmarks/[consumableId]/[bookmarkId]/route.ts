import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";

const updateSchema = z.object({
  positionMs: z.number().min(0),
  note: z.string().max(1000),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ consumableId: string; bookmarkId: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { consumableId, bookmarkId } = await context.params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
    }
    await auth.client.updateBookmark(
      bookmarkId,
      consumableId,
      parsed.data.positionMs,
      parsed.data.note,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ consumableId: string; bookmarkId: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { bookmarkId } = await context.params;
    await auth.client.deleteBookmark(bookmarkId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
