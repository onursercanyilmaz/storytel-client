"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Compass,
  Download,
  Folder,
  FolderPlus,
  Globe,
  Headphones,
  Heart,
  Loader2,
  LogOut,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import type { BookshelfBook, CustomCollection } from "@/lib/storytel/types";
import { toPlayingBook, usePlayer } from "./PlayerContext";
import { usePreferences } from "./PreferencesContext";
import StorytelLogo from "./StorytelLogo";
import PlayerBar from "./PlayerBar";
import BookDetailModal from "./BookDetailModal";
import SearchView from "./SearchView";
import { DownloadsView, StatsView } from "./StatsAndDownloadsView";
import { formatDurationMs } from "@/lib/format";

type ActiveNav =
  | { type: "library" }
  | { type: "search" }
  | { type: "favorites" }
  | { type: "downloads" }
  | { type: "stats" }
  | { type: "collection"; id: string };

const GROUP_COLORS = [
  "#FF5500",
  "#E11D48",
  "#7C3AED",
  "#2563EB",
  "#059669",
  "#D97706",
  "#DB2777",
  "#0891B2",
];

interface StorytelAppProps {
  email: string;
  authMode: "sso" | "legacy";
  onLogout: () => void;
}

export default function StorytelApp({ email, onLogout }: StorytelAppProps) {
  const { playBook, currentBook, isPlaying, stopPlayer } = usePlayer();
  const { lang, theme, toggleLang, toggleTheme, t } = usePreferences();

  const [nav, setNav] = useState<ActiveNav>({ type: "library" });

  const [books, setBooks] = useState<BookshelfBook[]>([]);
  const [collections, setCollections] = useState<CustomCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "consuming" | "will_consume" | "consumed"
  >("all");
  const [sortBy, setSortBy] = useState<
    "recent" | "title" | "duration" | "progress"
  >("recent");
  const [libraryQuery, setLibraryQuery] = useState("");

  const [detailBookId, setDetailBookId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchSubmitQuery, setSearchSubmitQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);

  // Ctrl+K / Cmd+K focuses global search bar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3000);
  }, []);

  const fetchBookshelf = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await fetch("/api/bookshelf");
        if (res.status === 401) {
          onLogout();
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Kitaplık yüklenemedi.");
          return;
        }
        setBooks(data.books || []);
        setCollections(data.collections || []);
      } catch {
        setError("Sunucuya bağlanılamadı.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onLogout],
  );

  useEffect(() => {
    void fetchBookshelf();
  }, [fetchBookshelf]);

  const shelfBookIds = useMemo(() => new Set(books.map((b) => b.id)), [books]);

  // Featured "Continue Listening" hero book (Storytel signature home card)
  const continueBook = useMemo(() => {
    return (
      books.find((b) => b.status === "consuming") ||
      books.find((b) => b.progress > 0 && b.progress < 99) ||
      books[0] ||
      null
    );
  }, [books]);

  const handleLogout = async () => {
    stopPlayer();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    onLogout();
  };

  const handleToggleFavorite = async (bookId: string) => {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    if (res.ok) {
      const data = await res.json();
      setBooks((prev) =>
        prev.map((b) =>
          b.id === bookId ? { ...b, isFavorite: data.isFavorite } : b,
        ),
      );
      showToast(
        data.isFavorite ? "Beğenilenlere eklendi" : "Beğenilenlerden çıkarıldı",
      );
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor }),
    });
    if (res.ok) {
      const data = await res.json();
      setCollections((prev) => [...prev, data.collection]);
      setNewGroupName("");
      setShowNewGroupModal(false);
      setNav({ type: "collection", id: data.collection.id });
      showToast(`"${data.collection.name}" grubu oluşturuldu`);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    const res = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (nav.type === "collection" && nav.id === id) {
        setNav({ type: "library" });
      }
      showToast("Grup silindi");
    }
  };

  const handleToggleBookInCollection = async (
    collectionId: string,
    bookId: string,
  ) => {
    const res = await fetch(
      `/api/collections/${encodeURIComponent(collectionId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleBookId: bookId }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? data.collection : c)),
      );
      const isIn = data.collection.bookIds.includes(bookId);
      setBooks((prev) =>
        prev.map((b) => {
          if (b.id !== bookId) return b;
          const next = new Set(b.collectionIds || []);
          if (isIn) next.add(collectionId);
          else next.delete(collectionId);
          return { ...b, collectionIds: Array.from(next) };
        }),
      );
      showToast(
        isIn
          ? `"${data.collection.name}" grubuna eklendi`
          : `"${data.collection.name}" grubundan çıkarıldı`,
      );
    }
  };

  const handleAddToShelf = async (bookId: string) => {
    const res = await fetch("/api/bookshelf/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumableId: bookId }),
    });
    if (res.ok) {
      showToast("Kitaplığa eklendi");
      await fetchBookshelf(true);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Kitaplığa eklenemedi");
    }
  };

  const handleRemoveFromShelf = async (bookId: string) => {
    const res = await fetch("/api/bookshelf/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consumableId: bookId }),
    });
    if (res.ok) {
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      showToast("Kitaplıktan çıkarıldı");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Kitaplıktan çıkarılamadı");
    }
  };

  const displayedBooks = useMemo(() => {
    let list = [...books];

    if (nav.type === "favorites") {
      list = list.filter((b) => b.isFavorite);
    } else if (nav.type === "collection") {
      const col = collections.find((c) => c.id === nav.id);
      const idSet = new Set(col?.bookIds || []);
      list = list.filter((b) => idSet.has(b.id));
    } else if (nav.type === "library" && statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter);
    }

    if (libraryQuery.trim()) {
      const q = libraryQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.authors.toLowerCase().includes(q) ||
          b.narrators.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q),
      );
    }

    if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title, "tr"));
    } else if (sortBy === "duration") {
      list.sort((a, b) => b.durationMs - a.durationMs);
    } else if (sortBy === "progress") {
      list.sort((a, b) => b.progress - a.progress);
    }

    return list;
  }, [books, collections, nav, statusFilter, libraryQuery, sortBy]);

  const activeCollection =
    nav.type === "collection"
      ? collections.find((c) => c.id === nav.id)
      : undefined;

  const detailShelfBook = detailBookId
    ? books.find((b) => b.id === detailBookId)
    : undefined;

  const favCount = books.filter((b) => b.isFavorite).length;
  const dlCount = books.filter((b) => b.isDownloaded).length;

  return (
    <div className="min-h-screen st-bg st-ink flex flex-col">
      {/* Official Storytel Top Header (Clean 2-Tier Pro Layout) */}
      <header className="sticky top-0 z-30 st-surface/95 backdrop-blur-md border-b st-border">
        {/* Row 1: Brand | Wide Centered Search | Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNav({ type: "library" })}
              className="cursor-pointer"
            >
              <StorytelLogo size="md" />
            </button>
          </div>

          {/* Wide, Prominent Centered Search Bar (Ctrl+K) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!globalSearch.trim()) return;
              setSearchSubmitQuery(globalSearch.trim());
              setNav({ type: "search" });
            }}
            className="flex-1 max-w-xl mx-2"
          >
            <div className="relative w-full">
              <Search className="w-4 h-4 st-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full pl-11 pr-20 py-2.5 rounded-full st-bg border st-border text-sm st-ink placeholder:text-[#8A847C] focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-[#FF5500]/15 transition"
              />
              {globalSearch ? (
                <button
                  type="button"
                  onClick={() => setGlobalSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full st-muted hover:st-ink cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center absolute right-3.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md st-surface border st-border text-[11px] st-muted font-mono pointer-events-none">
                  Ctrl K
                </kbd>
              )}
            </div>
          </form>

          {/* Right Utilities */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-full st-bg border st-border text-xs font-bold st-ink hover:border-[#FF5500] inline-flex items-center gap-1 transition cursor-pointer"
              title="Switch Language / Dil Değiştir"
            >
              <Globe className="w-3.5 h-3.5 text-[#FF5500]" />
              {lang.toUpperCase()}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full st-bg border st-border st-muted hover:text-[#FF5500] transition cursor-pointer"
              title={theme === "dark" ? t("nav.themeLight") : t("nav.themeDark")}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <div
              className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full st-bg border st-border"
              title={email || "Storytel"}
            >
              <span className="w-7 h-7 rounded-full st-accent-bg text-white text-xs font-bold flex items-center justify-center uppercase shrink-0">
                {(email || "S").charAt(0)}
              </span>
              <span className="hidden xl:inline text-xs font-semibold st-ink max-w-[140px] truncate">
                {email?.split("@")[0] || "Storytel"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-full st-muted hover:text-red-500 transition cursor-pointer"
                title={t("nav.logout")}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Clean Navigation Tabs Bar */}
        <div className="border-t st-border/60">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto">
            {[
              {
                id: "library",
                label: t("nav.library"),
                icon: BookOpen,
                active: nav.type === "library" || nav.type === "collection",
                target: { type: "library" } as ActiveNav,
              },
              {
                id: "search",
                label: t("nav.discover"),
                icon: Compass,
                active: nav.type === "search",
                target: { type: "search" } as ActiveNav,
              },
              {
                id: "favorites",
                label: t("nav.favorites"),
                icon: Heart,
                count: favCount,
                active: nav.type === "favorites",
                target: { type: "favorites" } as ActiveNav,
              },
              {
                id: "downloads",
                label: t("nav.downloads"),
                icon: Download,
                count: dlCount,
                active: nav.type === "downloads",
                target: { type: "downloads" } as ActiveNav,
              },
              {
                id: "stats",
                label: t("nav.stats"),
                icon: BarChart3,
                active: nav.type === "stats",
                target: { type: "stats" } as ActiveNav,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setNav(item.target)}
                  className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                    item.active
                      ? "st-accent-soft text-[#FF5500]"
                      : "st-muted hover:st-ink"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                  {typeof item.count === "number" && item.count > 0 && (
                    <span className="text-[11px] opacity-75">
                      ({item.count})
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 ${
          currentBook ? "pb-32" : "pb-14"
        }`}
      >
        {/* Storytel Signature "Continue Listening" Hero Card */}
        {nav.type === "library" && !loading && continueBook && (
          <section className="mb-9 rounded-3xl st-surface border st-border p-5 sm:p-7 relative overflow-hidden shadow-sm">
            {continueBook.coverUrl && (
              <div
                className="pointer-events-none absolute -right-12 -top-12 w-72 h-72 rounded-full opacity-15 blur-3xl bg-center bg-cover"
                style={{ backgroundImage: `url(${continueBook.coverUrl})` }}
              />
            )}
            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <button
                type="button"
                onClick={() => setDetailBookId(continueBook.id)}
                className="relative shrink-0 cursor-pointer group"
              >
                {continueBook.coverUrl ? (
                  <img
                    src={continueBook.coverUrl}
                    alt={continueBook.title}
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl object-cover st-cover-shadow group-hover:scale-[1.02] transition"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl st-surface-alt" />
                )}
                <span className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/95 text-[#1A1715] flex items-center justify-center shadow">
                  <Headphones className="w-3.5 h-3.5" />
                </span>
              </button>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#FF5500] mb-1.5">
                  {t("lib.continueListening")}
                </span>
                <h2 className="font-serif-st text-2xl sm:text-3xl font-bold st-ink leading-tight">
                  {continueBook.title}
                </h2>
                <p className="text-sm st-muted mt-1">{continueBook.authors}</p>

                <div className="max-w-md mx-auto sm:mx-0 mt-4 space-y-1.5">
                  <div className="h-1.5 st-surface-alt rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FF5500] rounded-full"
                      style={{ width: `${continueBook.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-medium st-muted">
                    <span>
                      {continueBook.progress}% {t("lib.completed")}
                    </span>
                    <span>
                      {continueBook.durationMs > 0
                        ? `${formatDurationMs(Math.max(0, continueBook.durationMs - continueBook.positionMs))} ${t("lib.remaining")}`
                        : ""}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => playBook(toPlayingBook(continueBook))}
                    className="px-6 py-2.5 rounded-full st-accent-bg text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-[#FF5500]/25 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {t("lib.continueListening")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailBookId(continueBook.id)}
                    className="px-4 py-2.5 rounded-full st-bg border st-border hover:border-[#FF5500] text-sm font-semibold st-ink transition cursor-pointer"
                  >
                    {t("lib.details")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section Header + Library Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h1 className="font-serif-st text-2xl sm:text-3xl font-bold st-ink flex items-center gap-2.5">
            {activeCollection && (
              <span
                className="w-3.5 h-3.5 rounded-full inline-block"
                style={{ backgroundColor: activeCollection.color }}
              />
            )}
            {nav.type === "library"
              ? t("nav.library")
              : nav.type === "search"
                ? t("search.title")
                : nav.type === "favorites"
                  ? t("nav.favorites")
                  : nav.type === "downloads"
                    ? t("nav.downloads")
                    : nav.type === "stats"
                      ? t("stats.title")
                      : activeCollection?.name || "Group"}
          </h1>

          {(nav.type === "library" ||
            nav.type === "favorites" ||
            nav.type === "collection") && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 st-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  placeholder={t("lib.searchPlaceholder")}
                  className="pl-9 pr-3.5 py-2 w-44 sm:w-52 rounded-full st-surface border st-border text-xs st-ink placeholder:text-[#9A938A] focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3.5 py-2 rounded-full st-surface border st-border text-xs font-semibold st-ink focus:outline-none focus:border-[#FF5500]"
              >
                <option value="recent">{t("lib.sort.recent")}</option>
                <option value="title">{t("lib.sort.title")}</option>
                <option value="progress">{t("lib.sort.progress")}</option>
                <option value="duration">{t("lib.sort.duration")}</option>
              </select>

              <button
                type="button"
                onClick={() => fetchBookshelf(true)}
                disabled={refreshing}
                className="p-2 rounded-full st-surface border st-border st-muted hover:text-[#FF5500] transition cursor-pointer"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          )}
        </div>

        {/* Status Tabs + Custom Collections Pill Strip */}
        {(nav.type === "library" || nav.type === "collection") && (
          <div className="space-y-3 mb-7">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: t("lib.tab.all"), count: books.length },
                {
                  id: "consuming",
                  label: t("lib.tab.consuming"),
                  count: books.filter((b) => b.status === "consuming").length,
                },
                {
                  id: "will_consume",
                  label: t("lib.tab.will_consume"),
                  count: books.filter((b) => b.status === "will_consume").length,
                },
                {
                  id: "consumed",
                  label: t("lib.tab.consumed"),
                  count: books.filter((b) => b.status === "consumed").length,
                },
              ].map((tabItem) => {
                const isSelected =
                  nav.type === "library" && statusFilter === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => {
                      setNav({ type: "library" });
                      setStatusFilter(tabItem.id as any);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "st-accent-bg text-white shadow-sm"
                        : "st-surface border st-border st-muted hover:st-ink"
                    }`}
                  >
                    {tabItem.label} ({tabItem.count})
                  </button>
                );
              })}
            </div>

            {/* Custom Groups / Collections Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold st-muted mr-1">
                {t("lib.groups")}
              </span>
              {collections.map((col) => {
                const isActive = nav.type === "collection" && nav.id === col.id;
                return (
                  <div
                    key={col.id}
                    className={`inline-flex items-center rounded-full border text-xs font-semibold transition ${
                      isActive
                        ? "st-accent-soft border-[#FF5500] text-[#FF5500]"
                        : "st-surface st-border st-ink hover:border-[#FF5500]/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setNav({ type: "collection", id: col.id })}
                      className="pl-3 pr-2 py-1.5 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      {col.name} ({col.bookIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(col.id)}
                      className="pr-2.5 pl-1 py-1.5 st-muted hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowNewGroupModal(true)}
                className="px-3 py-1.5 rounded-full border border-dashed st-border hover:border-[#FF5500] text-xs font-semibold st-muted hover:text-[#FF5500] flex items-center gap-1 transition cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                {t("lib.newGroup")}
              </button>
            </div>
          </div>
        )}

        {/* Active View */}
        {nav.type === "search" ? (
          <SearchView
            initialQuery={searchSubmitQuery}
            shelfBookIds={shelfBookIds}
            onAddToShelf={handleAddToShelf}
            onOpenDetail={(id) => setDetailBookId(id)}
          />
        ) : nav.type === "downloads" ? (
          <DownloadsView
            books={books}
            onChanged={() => void fetchBookshelf(true)}
          />
        ) : nav.type === "stats" ? (
          <StatsView onOpenDetail={(id) => setDetailBookId(id)} />
        ) : loading ? (
          <div className="py-24 flex flex-col items-center gap-3 st-muted">
            <Loader2 className="w-8 h-8 text-[#FF5500] animate-spin" />
            <span className="text-sm font-medium">Kitaplığın yükleniyor...</span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-3xl st-surface border border-red-500/30 text-center space-y-3">
            <p className="text-sm text-red-500 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => fetchBookshelf()}
              className="px-5 py-2 rounded-full st-accent-bg text-white text-xs font-bold cursor-pointer"
            >
              Tekrar Dene
            </button>
          </div>
        ) : displayedBooks.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Folder className="w-10 h-10 st-muted opacity-40 mx-auto" />
            <p className="text-sm font-medium st-muted">
              {nav.type === "favorites"
                ? "Henüz beğendiğin bir kitap yok."
                : nav.type === "collection"
                  ? "Bu grupta henüz kitap yok. Kitap detayına tıklayıp bu gruba ekleyebilirsin."
                  : "Gösterilecek kitap bulunamadı."}
            </p>
          </div>
        ) : (
          /* Crisp Storytel Desktop Book Cards (AUDIOBOOK badge + remaining + % + orange bar) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayedBooks.map((book) => {
              const isCurrent = currentBook?.id === book.id;
              const remainingMs = Math.max(0, book.durationMs - book.positionMs);
              return (
                <div
                  key={book.id}
                  className={`group st-surface border rounded-2xl p-3 flex flex-col transition ${
                    isCurrent
                      ? "border-[#FF5500] shadow-lg shadow-[#FF5500]/10"
                      : "st-border hover:border-[#FF5500]/50"
                  }`}
                >
                  {/* Square Audiobook Cover */}
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-[#1E1E1E]">
                    <button
                      type="button"
                      onClick={() => setDetailBookId(book.id)}
                      className="w-full h-full block cursor-pointer"
                    >
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center st-muted">
                          <Headphones className="w-10 h-10" />
                        </div>
                      )}
                    </button>

                    {/* AUDIOBOOK Pill Badge (Bottom Left) */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider">
                        AUDIOBOOK
                      </span>
                      {book.isDownloaded && (
                        <span
                          className="w-5 h-5 rounded-md bg-emerald-600/90 text-white flex items-center justify-center"
                          title="Offline"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    {/* Favorite Heart */}
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(book.id)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow transition cursor-pointer ${
                        book.isFavorite
                          ? "bg-[#FF5500] text-white"
                          : "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-[#FF5500]"
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${book.isFavorite ? "fill-current" : ""}`}
                      />
                    </button>

                    {/* Quick Play Button */}
                    <button
                      type="button"
                      onClick={() => playBook(toPlayingBook(book))}
                      className="absolute bottom-2 right-2 w-9 h-9 rounded-full st-accent-bg text-white shadow-lg flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition cursor-pointer"
                      title={t("search.listen")}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>
                  </div>

                  {/* Metadata */}
                  <div className="mt-3 flex-1 flex flex-col">
                    <button
                      type="button"
                      onClick={() => setDetailBookId(book.id)}
                      className="text-left text-xs sm:text-sm font-bold st-ink hover:text-[#FF5500] line-clamp-2 leading-snug transition cursor-pointer"
                    >
                      {book.title}
                    </button>
                    <p className="text-[11px] st-muted truncate mt-1">
                      {book.authors}
                    </p>

                    <div className="mt-auto pt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] st-muted">
                        <span className="truncate">
                          {remainingMs > 0
                            ? `${formatDurationMs(remainingMs)} ${t("lib.remaining")}`
                            : formatDurationMs(book.durationMs)}
                        </span>
                        <span className="font-mono font-semibold shrink-0 ml-1">
                          {isCurrent && isPlaying
                            ? t("lib.playing")
                            : `${book.progress}%`}
                        </span>
                      </div>
                      <div className="h-1 st-surface-alt rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#FF5500] rounded-full"
                          style={{ width: `${Math.max(book.progress > 0 ? 3 : 0, book.progress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Storytel Persistent & Expandable Player */}
      <PlayerBar onOpenBookDetail={(id) => setDetailBookId(id)} />

      {/* Book Detail Modal */}
      {detailBookId && (
        <BookDetailModal
          bookId={detailBookId}
          shelfBook={detailShelfBook}
          collections={collections}
          onClose={() => setDetailBookId(null)}
          onToggleFavorite={handleToggleFavorite}
          onToggleCollection={handleToggleBookInCollection}
          onAddToShelf={handleAddToShelf}
          onRemoveFromShelf={handleRemoveFromShelf}
          onDownloadChange={() => void fetchBookshelf(true)}
        />
      )}

      {/* New Custom Collection Modal */}
      {showNewGroupModal && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowNewGroupModal(false)}
        >
          <form
            onSubmit={handleCreateGroup}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl st-surface border st-border p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif-st text-lg font-bold st-ink">
                Yeni Grup Oluştur
              </h3>
              <button
                type="button"
                onClick={() => setShowNewGroupModal(false)}
                className="st-muted hover:text-[#FF5500] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              required
              maxLength={60}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Örn: Uyurken Dinlediklerim, Bilim Kurgu..."
              className="w-full px-4 py-3 rounded-2xl st-bg border st-border text-sm st-ink placeholder:text-[#9A938A] focus:outline-none focus:border-[#FF5500]"
            />

            <div>
              <div className="text-xs font-semibold st-muted mb-2">
                Grup Rengi
              </div>
              <div className="flex items-center gap-2">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewGroupColor(color)}
                    className={`w-7 h-7 rounded-full transition cursor-pointer ${
                      newGroupColor === color
                        ? "ring-2 ring-[#FF5500] ring-offset-2 scale-110"
                        : "opacity-75 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full st-accent-bg text-white text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Oluştur
            </button>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-5 z-50 px-4 py-2.5 rounded-full bg-[#1A1715] text-white text-xs font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
