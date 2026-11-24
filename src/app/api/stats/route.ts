import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import { getListeningStats, recordListeningProgress } from "@/lib/local-store";

const postSchema = z.object({
  seconds: z.number().min(0).max(300),
  book: z
    .object({
      id: z.string(),
      title: z.string(),
      authors: z.string(),
      coverUrl: z.string(),
      positionMs: z.number(),
      durationMs: z.number(),
    })
    .optional(),
});

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  return NextResponse.json(getListeningStats());
}

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istatistik verisi." }, { status: 400 });
  }

  const stats = recordListeningProgress(parsed.data);
  return NextResponse.json(stats);
}
