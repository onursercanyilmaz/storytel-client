import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import { toggleFavorite } from "@/lib/local-store";

const schema = z.object({
  bookId: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz kitap ID." }, { status: 400 });
  }

  const result = toggleFavorite(parsed.data.bookId);
  return NextResponse.json(result);
}
