import { NextResponse } from "next/server";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";
import type { BookshelfBook, SearchResultBook } from "@/lib/storytel/types";

export interface RecommendedBook extends SearchResultBook {
  recommendationReason?: string;
}

interface RecommendationsPayload {
  recommendations: RecommendedBook[];
  chips: { label: string; query: string; type: "author" | "category" }[];
}

const recCache = new Map<string, { data: RecommendationsPayload; cachedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 dakika önbellek

export async function GET(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "true";

  const cacheKey = await auth.client.getBearerToken().catch(() => "default_user");
  const cached = recCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const shelf: BookshelfBook[] = await auth.client.getBookshelf().catch(() => []);
    const shelfBookIds = new Set(shelf.map((b) => b.id));

    // Kitaplıktan yazar ve kategori frekanslarını puanlayarak çıkar
    const authorCounts = new Map<string, { count: number; sampleTitle: string }>();
    const categoryCounts = new Map<string, number>();

    for (const b of shelf) {
      if (b.authors) {
        const authors = b.authors.split(",").map((a) => a.trim()).filter(Boolean);
        for (const a of authors) {
          const cur = authorCounts.get(a) || { count: 0, sampleTitle: b.title };
          const boost = b.status === "consuming" ? 3 : b.isFavorite ? 2 : 1;
          authorCounts.set(a, { count: cur.count + boost, sampleTitle: b.title });
        }
      }
      if (b.category && b.category.trim()) {
        const cat = b.category.trim();
        const cur = categoryCounts.get(cat) || 0;
        const boost = b.status === "consuming" ? 3 : b.isFavorite ? 2 : 1;
        categoryCounts.set(cat, cur + boost);
      }
    }

    const sortedAuthors = Array.from(authorCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const chips: { label: string; query: string; type: "author" | "category" }[] = [];
    for (const [author] of sortedAuthors) {
      chips.push({ label: author, query: author, type: "author" });
    }
    for (const [cat] of sortedCategories) {
      chips.push({ label: cat, query: cat, type: "category" });
    }

    // Kitaplık henüz boşsa popüler varsayılan kategorileri ekle
    if (chips.length < 3) {
      const defaultPills = ["Polisiye", "Klasikler", "Kişisel Gelişim", "Bilim Kurgu", "Roman"];
      for (const p of defaultPills) {
        if (!chips.some((c) => c.label.toLowerCase() === p.toLowerCase())) {
          chips.push({ label: p, query: p, type: "category" });
        }
      }
    }

    // Arama hedefleri oluştur
    const searchTargets: { query: string; reason: string }[] = [];

    for (const [author, info] of sortedAuthors.slice(0, 3)) {
      searchTargets.push({
        query: author,
        reason: `Kitaplığındaki "${info.sampleTitle}" yazarı ${author}'dan`,
      });
    }

    for (const [cat] of sortedCategories.slice(0, 2)) {
      searchTargets.push({
        query: cat,
        reason: `İlgilendiğin "${cat}" türünden öneriler`,
      });
    }

    if (searchTargets.length === 0) {
      searchTargets.push(
        { query: "Polisiye", reason: "Storytel'de popüler polisiye & gerilim kitapları" },
        { query: "Klasikler", reason: "Herkesin okuması gereken dünya klasikleri" },
      );
    }

    // Paralel arama yap
    const searchPromises = searchTargets.map(async (target) => {
      try {
        const books = await auth.client.searchCatalog(target.query);
        return books.map((b) => ({
          ...b,
          recommendationReason: target.reason,
        }));
      } catch {
        return [];
      }
    });

    const resultsByTarget = await Promise.all(searchPromises);

    // Sonuçları harmanla, kitaplıkta olanları ve mükerrerleri filtrele
    const seenIds = new Set<string>();
    const recommendations: RecommendedBook[] = [];

    const maxLen = Math.max(...resultsByTarget.map((r) => r.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const list of resultsByTarget) {
        if (i < list.length) {
          const item = list[i];
          if (!shelfBookIds.has(item.id) && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            recommendations.push(item);
            if (recommendations.length >= 24) break;
          }
        }
      }
      if (recommendations.length >= 24) break;
    }

    const payload: RecommendationsPayload = {
      recommendations,
      chips,
    };

    recCache.set(cacheKey, { data: payload, cachedAt: Date.now() });

    return NextResponse.json(payload);
  } catch (err) {
    return handleApiError(err);
  }
}
