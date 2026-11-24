import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import { findDownloadedFile, isValidBookId } from "@/lib/downloads";

export const dynamic = "force-dynamic";

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { bookId } = await context.params;
    if (!isValidBookId(bookId)) {
      return NextResponse.json({ error: "Geçersiz kitap ID." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const abookId = searchParams.get("abookId");

    // Fetch details for filename
    const details = await auth.client.getBookDetails(bookId).catch(() => null);
    const title = details?.title || `storytel-audio-${bookId}`;
    const filename = `${sanitizeFilename(title)}.mp3`;

    // 1. Check if already downloaded locally
    const localFile = findDownloadedFile(bookId);
    if (localFile && fs.existsSync(localFile)) {
      const stat = fs.statSync(localFile);
      const nodeStream = fs.createReadStream(localFile);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on("data", (chunk) => controller.enqueue(chunk));
          nodeStream.on("end", () => controller.close());
          nodeStream.on("error", (err) => controller.error(err));
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      return new NextResponse(webStream as any, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Content-Length": String(stat.size),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // 2. Stream directly from Storytel CDN to browser
    const streamUrl = await auth.client.getAudioStreamUrl(bookId, abookId);
    const cdnRes = await fetch(streamUrl, {
      signal: AbortSignal.timeout(60000),
    });

    if (!cdnRes.ok || !cdnRes.body) {
      return NextResponse.json(
        { error: `Ses akışı indirilemedi (HTTP ${cdnRes.status}).` },
        { status: cdnRes.status },
      );
    }

    const contentLength = cdnRes.headers.get("content-length");

    return new NextResponse(cdnRes.body as any, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
