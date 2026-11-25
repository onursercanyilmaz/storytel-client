import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import {
  getListeningStats,
  getVocabulary,
  recordListeningProgress,
  updateListeningGoals,
} from "@/lib/local-store";
import { computeStreaksAndBadges } from "@/lib/srs";

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

const patchSchema = z.object({
  dailyGoalMinutes: z.number().min(5).max(600).optional(),
  yearlyBookGoal: z.number().min(1).max(500).optional(),
});

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const stats = getListeningStats();
  const vocabCount = getVocabulary().length;
  return NextResponse.json({
    ...stats,
    streaksAndBadges: computeStreaksAndBadges(stats, vocabCount),
  });
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

export async function PATCH(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz hedef verisi." }, { status: 400 });
  }

  const stats = updateListeningGoals(parsed.data);
  const vocabCount = getVocabulary().length;
  return NextResponse.json({
    ...stats,
    streaksAndBadges: computeStreaksAndBadges(stats, vocabCount),
  });
}
