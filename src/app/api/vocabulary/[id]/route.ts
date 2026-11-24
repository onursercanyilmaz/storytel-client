import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import { deleteVocabEntry, updateVocabEntry } from "@/lib/local-store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  word: z.string().min(1).max(120).optional(),
  meaning: z.string().max(500).optional(),
  context: z.string().max(600).optional(),
  mastered: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 });
  }

  const entry = updateVocabEntry(id, parsed.data);
  if (!entry) {
    return NextResponse.json({ error: "Kelime bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ entry });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const deleted = deleteVocabEntry(id);
  if (!deleted) {
    return NextResponse.json({ error: "Kelime bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
