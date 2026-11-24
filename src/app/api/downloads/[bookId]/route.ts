import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import {
  cancelOrDeleteDownload,
  getDownloadStatus,
  isValidBookId,
  startBackgroundDownload,
} from "@/lib/downloads";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { bookId } = await context.params;
  if (!isValidBookId(bookId)) {
    return NextResponse.json({ error: "Geçersiz kitap ID." }, { status: 400 });
  }
  return NextResponse.json(getDownloadStatus(bookId));
}

export async function POST(
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

    const existing = getDownloadStatus(bookId);
    if (existing.downloaded) {
      return NextResponse.json({
        downloaded: true,
        bytes: existing.bytes,
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      abookId?: string | null;
    };

    const streamUrl = await auth.client.getAudioStreamUrl(bookId, body.abookId);
    const active = startBackgroundDownload(
      bookId,
      body.title || `Kitap ${bookId}`,
      streamUrl,
    );

    return NextResponse.json({ started: true, active });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { bookId } = await context.params;
  if (!isValidBookId(bookId)) {
    return NextResponse.json({ error: "Geçersiz kitap ID." }, { status: 400 });
  }

  const deleted = cancelOrDeleteDownload(bookId);
  return NextResponse.json({ deleted });
}
