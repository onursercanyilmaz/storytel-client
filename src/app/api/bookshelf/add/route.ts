import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";

const schema = z.object({
  consumableId: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz kitap ID." }, { status: 400 });
    }
    const added = await auth.client.addToBookshelf(parsed.data.consumableId);
    if (!added) {
      return NextResponse.json(
        { error: "Storytel kitabı kitaplığa eklemeyi onaylamadı." },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
