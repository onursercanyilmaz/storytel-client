import { NextResponse } from "next/server";
import { requireStorytelClient } from "@/lib/api-helpers";
import { parseEpubBuffer } from "@/lib/epub-parser";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Lütfen bir .epub dosyası seçin." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Dosya boyutu 25 MB'dan küçük olmalıdır." },
        { status: 413 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = parseEpubBuffer(buf);

    if (parsed.drmProtected) {
      return NextResponse.json(
        { error: "Bu .epub dosyası DRM korumalıdır." },
        { status: 422 },
      );
    }
    if (parsed.chapters.length === 0) {
      return NextResponse.json(
        { error: "EPUB içinde okunabilir bölüm bulunamadı." },
        { status: 422 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "EPUB dosyası okunamadı." },
      { status: 400 },
    );
  }
}
