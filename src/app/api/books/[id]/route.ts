import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import { getDownloadStatus } from "@/lib/downloads";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const [details, chapters, bookmarks, positionMs] = await Promise.all([
      auth.client.getBookDetails(id).catch(() => null),
      auth.client.getChapters(id).catch(() => []),
      auth.client.getBookmarks(id).catch(() => []),
      auth.client.getPositionalBookmark(id).catch(() => 0),
    ]);

    const formats: any[] = Array.isArray(details?.formats) ? details.formats : [];
    const abook = formats.find((f) => f.type === "abook");
    const dl = getDownloadStatus(id);

    const joinNames = (arr?: any[]) =>
      Array.isArray(arr)
        ? arr
            .map((x) => x?.name)
            .filter(Boolean)
            .join(", ")
        : "";

    const rawCover =
      abook?.cover?.url ||
      formats[0]?.cover?.url ||
      details?.cover?.url ||
      "";
    const coverUrl =
      rawCover && !/^https?:\/\//i.test(rawCover)
        ? `https://www.storytel.com${rawCover.startsWith("/") ? "" : "/"}${rawCover}`
        : rawCover;

    return NextResponse.json({
      id,
      abookId: abook?.id ? String(abook.id) : null,
      title: String(details?.title || ""),
      authors: joinNames(details?.authors),
      narrators: joinNames(details?.narrators),
      coverUrl,
      category: String(details?.category?.name || details?.category?.title || ""),
      language: String(
        details?.language?.isoValue || details?.language?.iso || "",
      ).toLowerCase(),
      languageName: String(
        details?.language?.localizedName || details?.language?.name || "",
      ),
      description: String(details?.description || abook?.description || ""),
      durationMs: Number(abook?.durationInMilliseconds || details?.duration || 0),
      positionMs,
      chapters,
      bookmarks,
      isDownloaded: dl.downloaded,
      downloadedBytes: dl.bytes,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
