import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import { getLibraryMeta } from "@/lib/local-store";
import { listDownloads } from "@/lib/downloads";

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const books = await auth.client.getBookshelf();
    const meta = getLibraryMeta();
    const downloads = listDownloads();

    const favSet = new Set(meta.favorites);
    const dlMap = new Map(downloads.files.map((f) => [f.bookId, f.bytes]));

    const enriched = books.map((book) => ({
      ...book,
      isFavorite: favSet.has(book.id),
      collectionIds: meta.collections
        .filter((c) => c.bookIds.includes(book.id))
        .map((c) => c.id),
      isDownloaded: dlMap.has(book.id),
      downloadedBytes: dlMap.get(book.id),
    }));

    return NextResponse.json({
      books: enriched,
      collections: meta.collections,
      favorites: meta.favorites,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
