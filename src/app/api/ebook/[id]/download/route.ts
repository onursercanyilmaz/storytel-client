import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

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

    // Fetch details for filename
    const details = await auth.client.getBookDetails(id).catch(() => null);
    const title = details?.title || `storytel-ebook-${id}`;
    const filename = `${sanitizeFilename(title)}.epub`;

    const downloadUrl = await auth.client.getEbookDownloadUrl(id, ebookId);
    const absUrl = downloadUrl.startsWith("/")
      ? new URL(downloadUrl, "https://www.storytel.com").toString()
      : downloadUrl;

    const res = await fetch(absUrl, {
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `E-kitap dosyası indirilemedi (HTTP ${res.status}).` },
        { status: res.status },
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        {
          error:
            "Bu eserin Storytel sunucularında indirilebilir bir EPUB dosyası bulunmuyor.",
        },
        { status: 404 },
      );
    }

    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 403) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    return handleApiError(err);
  }
}
