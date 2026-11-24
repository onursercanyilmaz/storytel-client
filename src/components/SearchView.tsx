"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Loader2,
  Play,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { SearchResultBook } from "@/lib/storytel/types";
import { formatDurationMs, getLanguageLabel } from "@/lib/format";
import { usePlayer } from "./PlayerContext";
import { usePreferences } from "./PreferencesContext";

interface SearchViewProps {
  initialQuery?: string;
  shelfBookIds: Set<string>;
  onAddToShelf: (bookId: string) => Promise<void>;
  onOpenDetail: (bookId: string) => void;
}

export default function SearchView({
  initialQuery = "",
  shelfBookIds,
  onAddToShelf,
  onOpenDetail,
}: SearchViewProps) {
  const { playBook } = usePlayer();
  const { t, lang } = usePreferences();

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultBook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [langFilter, setLangFilter] = useState<string>("all");
  const [durationFilter, setDurationFilter] = useState<
    "all" | "short" | "medium" | "long"
  >("all");
  const [sortBy, setSortBy] = useState<"relevant" | "duration_asc" | "duration_desc">("relevant");

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setHasSearched(true);
    setLangFilter("all");
    setDurationFilter("all");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      const items: SearchResultBook[] = Array.isArray(data.results) ? data.results : [];
      setResults(items);
      setSelectedId(items[0]?.id ?? null);
    } catch {
      setResults([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
      void runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query);
  };

  const languageCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const r of results) {
      if (!r.language) continue;
      const cur = counts.get(r.language);
      if (cur) cur.count++;
      else
        counts.set(r.language, {
          label: getLanguageLabel(r.language, r.languageName),
          count: 1,
        });
    }
    return Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [results]);

  const filtered = useMemo(() => {
    const list = results.filter((r) => {
      if (langFilter !== "all" && r.language !== langFilter) return false;
      if (durationFilter !== "all" && r.durationMs > 0) {
        const hours = r.durationMs / 3600000;
        if (durationFilter === "short" && hours >= 5) return false;
        if (durationFilter === "medium" && (hours < 5 || hours > 15))
          return false;
        if (durationFilter === "long" && hours <= 15) return false;
      }
      return true;
    });

    if (sortBy === "duration_asc") {
      return [...list].sort((a, b) => a.durationMs - b.durationMs);
    }
    if (sortBy === "duration_desc") {
      return [...list].sort((a, b) => b.durationMs - a.durationMs);
    }
    return list;
  }, [results, langFilter, durationFilter, sortBy]);

  const selectedBook = useMemo(
    () => filtered.find((b) => b.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="flex gap-2.5 max-w-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 st-muted absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl st-surface border st-border text-sm st-ink placeholder:text-[#737373] focus:outline-none focus:border-[#FF5500] transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl st-accent-bg disabled:opacity-50 text-white text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {t("search.button")}
        </button>
      </form>

      {loading ? (
        <div className="py-24 flex flex-col items-center gap-3 st-muted">
          <Loader2 className="w-7 h-7 text-[#FF5500] animate-spin" />
          <span className="text-sm">{t("search.searching")}</span>
        </div>
      ) : !hasSearched ? (
        <div className="py-24 text-center space-y-2">
          <Sparkles className="w-9 h-9 text-[#FF5500]/70 mx-auto" />
          <h2 className="text-lg font-bold st-ink">{t("search.emptyTitle")}</h2>
          <p className="text-sm st-muted">{t("search.emptyDesc")}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="py-20 text-center text-sm st-muted">
          {t("search.noResults")}
        </div>
      ) : (
        /* Pro 3-Column Desktop Layout (Left Filter Rail | Center List | Right Preview Pane) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Filter Rail */}
          <aside className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider st-muted mb-2.5">
                {lang === "tr" ? "DİL" : "LANGUAGE"}
              </h3>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setLangFilter("all")}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                    langFilter === "all"
                      ? "st-accent-soft border border-[#FF5500]/40 st-ink"
                      : "st-muted hover:st-ink hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                        langFilter === "all"
                          ? "bg-[#FF5500] text-white"
                          : "border st-border"
                      }`}
                    >
                      {langFilter === "all" && <Check className="w-2.5 h-2.5" />}
                    </span>
                    {lang === "tr" ? "Tümü" : "All"}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full st-surface-alt text-[10px]">
                    {results.length}
                  </span>
                </button>

                {languageCounts.map(([code, info]) => {
                  const active = langFilter === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLangFilter(code)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                        active
                          ? "st-accent-soft border border-[#FF5500]/40 st-ink"
                          : "st-muted hover:st-ink hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                            active
                              ? "bg-[#FF5500] text-white"
                              : "border st-border"
                          }`}
                        >
                          {active && <Check className="w-2.5 h-2.5" />}
                        </span>
                        <span className="truncate">{info.label}</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full st-surface-alt text-[10px]">
                        {info.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider st-muted mb-2.5">
                {lang === "tr" ? "SÜRE" : "LENGTH"}
              </h3>
              <div className="space-y-1">
                {(
                  [
                    { id: "all", label: t("search.allDurations") },
                    { id: "short", label: "< 5 h" },
                    { id: "medium", label: "5–15 h" },
                    { id: "long", label: "> 15 h" },
                  ] as const
                ).map((opt) => {
                  const active = durationFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDurationFilter(opt.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition cursor-pointer ${
                        active
                          ? "st-accent-soft border border-[#FF5500]/40 st-ink"
                          : "st-muted hover:st-ink hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                          active
                            ? "bg-[#FF5500] text-white"
                            : "border st-border"
                        }`}
                      >
                        {active && <Check className="w-2.5 h-2.5" />}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Center Results List */}
          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between text-xs st-muted pb-1">
              <span>
                {filtered.length} {t("search.booksCount")}
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1 rounded-lg st-surface border st-border text-xs st-ink focus:outline-none focus:border-[#FF5500]"
              >
                <option value="relevant">
                  {lang === "tr" ? "En Alakalı" : "Most relevant"}
                </option>
                <option value="duration_asc">
                  {lang === "tr" ? "Süre (Artan)" : "Shortest first"}
                </option>
                <option value="duration_desc">
                  {lang === "tr" ? "Süre (Azalan)" : "Longest first"}
                </option>
              </select>
            </div>

            {filtered.map((book) => {
              const isSelected = selectedBook?.id === book.id;
              const onShelf = shelfBookIds.has(book.id);
              return (
                <div
                  key={book.id}
                  onClick={() => setSelectedId(book.id)}
                  className={`p-3 rounded-2xl border flex items-center gap-3.5 transition cursor-pointer ${
                    isSelected
                      ? "st-accent-soft border-[#FF5500]/50"
                      : "st-surface st-border hover:border-[#FF5500]/30"
                  }`}
                >
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 st-cover-shadow"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl st-surface-alt shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-[#FF5500]/15 text-[#FF5500] font-bold tracking-wide">
                        AUDIOBOOK
                      </span>
                      {book.language && (
                        <span className="px-1.5 py-0.5 rounded st-surface-alt st-ink font-semibold uppercase">
                          {book.language}
                        </span>
                      )}
                      {book.durationMs > 0 && (
                        <span className="st-muted">
                          {formatDurationMs(book.durationMs)}
                        </span>
                      )}
                      {book.category && (
                        <span className="st-muted truncate">
                          · {book.category}
                        </span>
                      )}
                    </div>

                    <div
                      className={`text-sm font-bold truncate mt-1 ${
                        isSelected ? "text-[#FF5500]" : "st-ink"
                      }`}
                    >
                      {book.title}
                    </div>
                    <div className="text-xs st-muted truncate">
                      {book.authors}
                      {book.narrators ? ` · ${book.narrators}` : ""}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onShelf ? (
                      <span
                        className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center"
                        title={t("search.onShelf")}
                      >
                        <Check className="w-4 h-4" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={addingId === book.id}
                        onClick={async () => {
                          setAddingId(book.id);
                          await onAddToShelf(book.id);
                          setAddingId(null);
                        }}
                        className="w-8 h-8 rounded-full st-surface-alt border st-border hover:border-[#FF5500] st-ink flex items-center justify-center transition cursor-pointer"
                        title={t("detail.addShelf")}
                      >
                        {addingId === book.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        playBook({
                          id: book.id,
                          title: book.title,
                          authors: book.authors,
                          narrators: book.narrators,
                          coverUrl: book.coverUrl,
                          durationMs: book.durationMs,
                        })
                      }
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                        isSelected
                          ? "st-accent-bg text-white shadow-md shadow-[#FF5500]/25"
                          : "st-surface-alt border st-border st-ink hover:border-[#FF5500]"
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {t("search.listen")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Preview Pane */}
          {selectedBook && (
            <aside className="lg:col-span-4 st-surface border st-border rounded-3xl p-6 sticky top-20 space-y-5">
              <div className="flex flex-col items-center text-center">
                {selectedBook.coverUrl ? (
                  <img
                    src={selectedBook.coverUrl}
                    alt={selectedBook.title}
                    className="w-44 h-44 rounded-2xl object-cover st-cover-shadow mb-4"
                  />
                ) : (
                  <div className="w-44 h-44 rounded-2xl st-surface-alt mb-4" />
                )}
                <h3 className="text-lg font-bold st-ink leading-snug">
                  {selectedBook.title}
                </h3>
                <p className="text-sm st-muted mt-0.5">{selectedBook.authors}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    playBook({
                      id: selectedBook.id,
                      title: selectedBook.title,
                      authors: selectedBook.authors,
                      narrators: selectedBook.narrators,
                      coverUrl: selectedBook.coverUrl,
                      durationMs: selectedBook.durationMs,
                    })
                  }
                  className="py-2.5 px-4 rounded-xl st-accent-bg text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-[#FF5500]/25 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {t("search.listen")}
                </button>

                {shelfBookIds.has(selectedBook.id) ? (
                  <button
                    type="button"
                    onClick={() => onOpenDetail(selectedBook.id)}
                    className="py-2.5 px-4 rounded-xl bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t("search.onShelf")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={addingId === selectedBook.id}
                    onClick={async () => {
                      setAddingId(selectedBook.id);
                      await onAddToShelf(selectedBook.id);
                      setAddingId(null);
                    }}
                    className="py-2.5 px-4 rounded-xl st-surface-alt border st-border hover:border-[#FF5500] st-ink text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("detail.addShelf")}
                  </button>
                )}
              </div>

              <div className="divide-y st-border text-xs">
                {selectedBook.language && (
                  <div className="py-2.5 flex justify-between">
                    <span className="st-muted">
                      {lang === "tr" ? "Dil" : "Language"}
                    </span>
                    <span className="font-semibold st-ink">
                      {getLanguageLabel(
                        selectedBook.language,
                        selectedBook.languageName,
                      )}
                    </span>
                  </div>
                )}
                {selectedBook.durationMs > 0 && (
                  <div className="py-2.5 flex justify-between">
                    <span className="st-muted">
                      {lang === "tr" ? "Süre" : "Duration"}
                    </span>
                    <span className="font-semibold st-ink">
                      {formatDurationMs(selectedBook.durationMs)}
                    </span>
                  </div>
                )}
                {selectedBook.narrators && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="st-muted shrink-0">
                      {lang === "tr" ? "Seslendiren" : "Narrator"}
                    </span>
                    <span className="font-semibold st-ink text-right truncate">
                      {selectedBook.narrators}
                    </span>
                  </div>
                )}
                {selectedBook.category && (
                  <div className="py-2.5 flex justify-between">
                    <span className="st-muted">
                      {lang === "tr" ? "Kategori" : "Category"}
                    </span>
                    <span className="font-semibold st-ink">
                      {selectedBook.category}
                    </span>
                  </div>
                )}
              </div>

              {selectedBook.description && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider st-muted mb-1.5">
                    {lang === "tr" ? "AÇIKLAMA" : "DESCRIPTION"}
                  </div>
                  <p className="text-xs st-muted leading-relaxed line-clamp-6">
                    {selectedBook.description}
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
