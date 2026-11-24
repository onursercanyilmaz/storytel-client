import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import { createCollection, getLibraryMeta } from "@/lib/local-store";

const createSchema = z.object({
  name: z.string().min(1, "Grup adı gereklidir.").max(60),
  color: z.string().max(20).optional(),
  icon: z.string().max(30).optional(),
});

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const meta = getLibraryMeta();
  return NextResponse.json({
    collections: meta.collections,
    favorites: meta.favorites,
  });
}

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Geçersiz grup verisi." },
      { status: 400 },
    );
  }

  const collection = createCollection(
    parsed.data.name,
    parsed.data.color,
    parsed.data.icon,
  );
  return NextResponse.json({ collection }, { status: 201 });
}
