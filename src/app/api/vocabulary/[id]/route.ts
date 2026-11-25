import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import {
  deleteVocabEntry,
  getVocabulary,
  updateVocabEntry,
} from "@/lib/local-store";
import { computeNextSrs, type SrsQuality } from "@/lib/srs";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  word: z.string().min(1).max(120).optional(),
  meaning: z.string().max(500).optional(),
  context: z.string().max(600).optional(),
  mastered: z.boolean().optional(),
  reviewQuality: z.union([z.literal(0), z.literal(2), z.literal(3), z.literal(5)]).optional(),
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

  const { reviewQuality, ...rest } = parsed.data;
  let patch: Parameters<typeof updateVocabEntry>[1] = rest;

  if (reviewQuality !== undefined) {
    const existing = getVocabulary().find((w) => w.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Kelime bulunamadı." }, { status: 404 });
    }
    const srs = computeNextSrs(existing, reviewQuality as SrsQuality);
    patch = { ...rest, ...srs };
  }

  const entry = updateVocabEntry(id, patch);
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
