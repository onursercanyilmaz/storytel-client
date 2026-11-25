import fs from "fs";
import { NextResponse } from "next/server";
import { requireStorytelClient } from "@/lib/api-helpers";
import { findLocalAudiobook } from "@/lib/local-audiobooks";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const book = findLocalAudiobook(id);
  if (!book || !fs.existsSync(book.filePath)) {
    return NextResponse.json({ error: "Yerel ses dosyası bulunamadı." }, { status: 404 });
  }

  const stat = fs.statSync(book.filePath);
  const total = stat.size;
  const contentType = book.format === "mp3" ? "audio/mpeg" : "audio/mp4";
  const range = request.headers.get("range");

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      if (start >= total || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(book.filePath, { start, end });
      return new NextResponse(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
        },
      });
    }
  }

  const stream = fs.createReadStream(book.filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Content-Type": contentType,
    },
  });
}
