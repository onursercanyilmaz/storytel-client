import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import { addHighlight, deleteHighlight, getHighlights } from "@/lib/local-store";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  bookId: z.string().min(1).max(120),
  bookTitle: z.string().max(200).optional(),
  chapterIndex: z.number().int().min(0),
  chapterTitle: z.string().max(200).optional(),
  text: z.string().min(1).max(2000),
  note: z.string().max(1000).optional(),
  color: z.enum(["yellow", "green", "pink", "blue"]).optional(),
});

export async function GET(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("bookId") || undefined;
  const highlights = getHighlights(bookId);
  return NextResponse.json({ highlights });
}

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz vurgu verisi." }, { status: 400 });
  }

  const entry = addHighlight(parsed.data);
  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID gerekli." }, { status: 400 });
  }

  const deleted = deleteHighlight(id);
  if (!deleted) {
    return NextResponse.json({ error: "Vurgu bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
