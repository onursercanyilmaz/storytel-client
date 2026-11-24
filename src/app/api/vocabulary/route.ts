import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import { addVocabEntry, getVocabulary } from "@/lib/local-store";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  word: z.string().min(1, "Kelime boş olamaz.").max(120),
  meaning: z.string().max(500).default(""),
  phonetic: z.string().max(100).optional(),
  context: z.string().max(600).optional(),
  bookId: z.string().optional(),
  bookTitle: z.string().max(200).optional(),
});

export async function GET(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId");

  let words = getVocabulary();
  if (bookId) {
    words = words.filter((w) => w.bookId === bookId);
  }

  return NextResponse.json({ words, total: words.length });
}

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Geçersiz kelime verisi." },
      { status: 400 },
    );
  }

  const entry = addVocabEntry(parsed.data);
  return NextResponse.json({ entry }, { status: 201 });
}
