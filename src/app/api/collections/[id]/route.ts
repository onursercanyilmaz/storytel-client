import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import { deleteCollection, updateCollection } from "@/lib/local-store";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(30).optional(),
  addBookId: z.string().optional(),
  removeBookId: z.string().optional(),
  toggleBookId: z.string().optional(),
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

  const updated = updateCollection(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ collection: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const deleted = deleteCollection(id);
  if (!deleted) {
    return NextResponse.json({ error: "Grup bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
