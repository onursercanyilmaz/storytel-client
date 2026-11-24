import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import { getDownloadStatus } from "@/lib/downloads";

interface CachedAssetSizes {
  audioBytes: number | null;
  ebookBytes: number | null;
  cachedAt: number;
}

const assetSizeCache = new Map<string, CachedAssetSizes>();
const SIZE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function probeAssetBytes(
  urlResolver: () => Promise<string>,
  timeoutMs = 2500,
): Promise<number | null> {
  try {
    const url = await Promise.race([
      urlResolver(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs),
      ),
    ]);
    if (!url) return null;
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const cl = res.headers.get("content-length");
    if (cl) {
      const parsed = parseInt(cl, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // Graceful fallback on network timeout or permission failure
  }
  return null;
}

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
    const ebook = formats.find((f) => f.type === "ebook");
    const dl = getDownloadStatus(id);
    const durationMs = Number(abook?.durationInMilliseconds || details?.duration || 0);

    // Audio & E-book asset size calculation (exact CDN Content-Length or duration bitrate fallback)
    const cachedSizes = assetSizeCache.get(id);
    const isCacheValid =
      cachedSizes && Date.now() - cachedSizes.cachedAt < SIZE_CACHE_TTL_MS;

    let audioBytes: number | null = null;
    let ebookBytes: number | null = null;

    if (dl.downloaded && typeof dl.bytes === "number" && dl.bytes > 0) {
      audioBytes = dl.bytes;
    } else if (isCacheValid && typeof cachedSizes.audioBytes === "number") {
      audioBytes = cachedSizes.audioBytes;
    }

    if (isCacheValid && typeof cachedSizes.ebookBytes === "number") {
      ebookBytes = cachedSizes.ebookBytes;
    }

    const tasks: Promise<void>[] = [];

    if (audioBytes === null && abook) {
      tasks.push(
        (async () => {
          const probed = await probeAssetBytes(() =>
            auth.client.getAudioStreamUrl(id, String(abook.id)),
          );
          audioBytes =
            probed ??
            (durationMs > 0 ? Math.round((durationMs / 1000) * 8500) : null);
        })(),
      );
    }

    if (ebookBytes === null && ebook) {
      tasks.push(
        (async () => {
          ebookBytes = await probeAssetBytes(() =>
            auth.client.getEbookDownloadUrl(id, String(ebook.id)),
          );
        })(),
      );
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
      assetSizeCache.set(id, {
        audioBytes,
        ebookBytes,
        cachedAt: Date.now(),
      });
    }

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
      ebookId: ebook?.id ? String(ebook.id) : null,
      hasAbook: !!abook,
      hasEbook: !!ebook,
      audioBytes,
      ebookBytes,
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
      durationMs,
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
