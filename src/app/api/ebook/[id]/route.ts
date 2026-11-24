import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import { parseEpubBuffer, type ParsedEbook } from "@/lib/epub-parser";

export const dynamic = "force-dynamic";

const ebookCache = new Map<string, { data: ParsedEbook; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const ebookId = searchParams.get("ebookId");

    const cached = ebookCache.get(id);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const downloadUrl = await auth.client.getEbookDownloadUrl(id, ebookId);
    const absUrl = downloadUrl.startsWith("/")
      ? new URL(downloadUrl, "https://www.storytel.com").toString()
      : downloadUrl;
    const res = await fetch(absUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `E-kitap indirilemedi (HTTP ${res.status}).` },
        { status: res.status },
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        {
          error:
            "Bu eserin Storytel üzerinde indirilebilir e-kitap (EPUB) sürümü bulunmuyor. Dilerseniz kendi .epub veya .pdf dosyanızı yükleyebilirsiniz.",
        },
        { status: 404 },
      );
    }

    const arrayBuf = await res.arrayBuffer();
    const parsed = parseEpubBuffer(Buffer.from(arrayBuf));

    if (parsed.drmProtected) {
      return NextResponse.json(
        {
          drmProtected: true,
          error:
            "Bu e-kitap DRM korumalı olduğu için doğrudan açılamıyor. İstersen kendi .epub dosyanı sol üstten yükleyerek sesli kitapla birlikte okuyabilirsin.",
        },
        { status: 422 },
      );
    }

    if (parsed.chapters.length === 0) {
      return NextResponse.json(
        { error: "E-kitap içinde okunabilir bölüm bulunamadı." },
        { status: 422 },
      );
    }

    ebookCache.set(id, { data: parsed, cachedAt: Date.now() });
    return NextResponse.json(parsed);
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.statusCode === 404) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    return handleApiError(err);
  }
}
