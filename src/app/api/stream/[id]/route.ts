import fs from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import { findDownloadedFile } from "@/lib/downloads";

// Short-lived in-memory cache of signed CDN URLs so Range requests don't
// re-hit api.storytel.net on every seek!
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const abookId = searchParams.get("abookId");
    const range = request.headers.get("range");

    // 1. Serve from local disk if already downloaded (instant offline playback!)
    const localPath = findDownloadedFile(id);
    if (localPath && fs.existsSync(localPath)) {
      const stat = fs.statSync(localPath);
      const total = stat.size;

      if (range) {
        const match = range.match(/bytes=(\d*)-(\d*)/);
        const start = match?.[1] ? parseInt(match[1], 10) : 0;
        const end = match?.[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;

        if (start >= total || start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${total}` },
          });
        }

        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(localPath, { start, end });
        const webStream = Readable.toWeb(stream) as ReadableStream;

        return new NextResponse(webStream, {
          status: 206,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Cache-Control": "private, max-age=3600",
          },
        });
      }

      const stream = fs.createReadStream(localPath);
      const webStream = Readable.toWeb(stream) as ReadableStream;
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Content-Length": String(total),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // 2. Otherwise proxy Storytel CDN signed URL with Range support
    const now = Date.now();
    let cached = streamUrlCache.get(id);
    if (!cached || cached.expiresAt <= now) {
      const signedUrl = await auth.client.getAudioStreamUrl(id, abookId);
      cached = { url: signedUrl, expiresAt: now + 10 * 60 * 1000 }; // 10 min
      streamUrlCache.set(id, cached);
    }

    const upstreamHeaders: Record<string, string> = {};
    if (range) upstreamHeaders["Range"] = range;

    let upstream = await fetch(cached.url, { headers: upstreamHeaders });
    if (upstream.status === 403 || upstream.status === 401) {
      // Signed URL expired — refresh once
      const freshUrl = await auth.client.getAudioStreamUrl(id, abookId);
      streamUrlCache.set(id, { url: freshUrl, expiresAt: now + 10 * 60 * 1000 });
      upstream = await fetch(freshUrl, { headers: upstreamHeaders });
    }

    const resHeaders = new Headers();
    resHeaders.set(
      "Content-Type",
      upstream.headers.get("content-type") || "audio/mpeg",
    );
    resHeaders.set("Accept-Ranges", "bytes");
    for (const h of ["content-length", "content-range", "etag"]) {
      const val = upstream.headers.get(h);
      if (val) resHeaders.set(h, val);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
