import { NextResponse } from "next/server";
import { requireStorytelClient } from "@/lib/api-helpers";
import {
  deleteLocalAudiobook,
  listLocalAudiobooks,
  saveLocalAudiobookBuffer,
} from "@/lib/local-audiobooks";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  return NextResponse.json({ books: listLocalAudiobooks() });
}

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const fd = await request.formData();
    const file = fd.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Ses dosyası (.mp3 / .m4b / .m4a) gerekli." }, { status: 400 });
    }
    if (!/\.(mp3|m4b|m4a)$/i.test(file.name)) {
      return NextResponse.json({ error: "Yalnızca .mp3, .m4b ve .m4a dosyaları desteklenir." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const entry = saveLocalAudiobookBuffer({
      fileName: file.name,
      title: String(fd.get("title") || ""),
      authors: String(fd.get("authors") || ""),
      buffer: buf,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dosya yüklenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID gerekli." }, { status: 400 });
  }
  const ok = deleteLocalAudiobook(id);
  if (!ok) {
    return NextResponse.json({ error: "Kitap bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
