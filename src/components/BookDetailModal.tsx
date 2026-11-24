"use client";

import React, { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkPlus,
  Check,
  Clock,
  Download,
  FolderPlus,
  Headphones,
  Heart,
  ListMusic,
  Loader2,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  BookDetailResponse,
  BookshelfBook,
  CustomCollection,
} from "@/lib/storytel/types";
import { usePlayer } from "./PlayerContext";
import { usePreferences } from "./PreferencesContext";
import {
  formatBytes,
  formatDurationMs,
  formatTime,
  getLanguageLabel,
} from "@/lib/format";

interface BookDetailModalProps {
  bookId: string;
  shelfBook?: BookshelfBook;
  collections: CustomCollection[];
  onClose: () => void;
  onToggleFavorite: (bookId: string) => void;
  onToggleCollection: (collectionId: string, bookId: string) => void;
  onAddToShelf: (bookId: string) => Promise<void>;
  onRemoveFromShelf: (bookId: string) => Promise<void>;
  onDownloadChange: () => void;
}

export default function BookDetailModal({
  bookId,
  shelfBook,
  collections,
  onClose,
  onToggleFavorite,
  onToggleCollection,
  onAddToShelf,
  onRemoveFromShelf,
  onDownloadChange,
}: BookDetailModalProps) {
  const { t } = usePreferences();
  const { playBook, currentBook, currentTime, refreshBookmarks } = usePlayer();
  const [detail, setDetail] = useState<BookDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"about" | "chapters" | "bookmarks">("about");
  const [shelfBusy, setShelfBusy] = useState(false);
  const [dlStatus, setDlStatus] = useState<{
    downloaded: boolean;
    bytes?: number;
    percentage?: number;
    downloading?: boolean;
  }>({
    downloaded: !!shelfBook?.isDownloaded,
    bytes: shelfBook?.downloadedBytes,
  });
  const [newNote, setNewNote] = useState("");
  const [addingBm, setAddingBm] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/books/${encodeURIComponent(bookId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setDlStatus({
          downloaded: !!data.isDownloaded,
          bytes: data.downloadedBytes,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bookId]);

  useEffect(() => {
    if (!dlStatus.downloading) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/downloads/${encodeURIComponent(bookId)}`);
        const data = await res.json();
        if (data.downloaded) {
          setDlStatus({
            downloaded: true,
            bytes: data.bytes,
            downloading: false,
            percentage: 100,
          });
          onDownloadChange();
        } else if (data.active) {
          setDlStatus({
            downloaded: false,
            downloading: data.active.status === "downloading",
            percentage: data.active.percentage,
          });
          if (data.active.status !== "downloading") onDownloadChange();
        } else {
          setDlStatus({ downloaded: false, downloading: false });
        }
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [dlStatus.downloading, bookId, onDownloadChange]);

  const title = detail?.title || shelfBook?.title || "Kitap Detayı";
  const authors = detail?.authors || shelfBook?.authors || "";
  const narrators = detail?.narrators || shelfBook?.narrators || "";
  const coverUrl = detail?.coverUrl || shelfBook?.coverUrl || "";
  const durationMs = detail?.durationMs || shelfBook?.durationMs || 0;
  const positionMs = detail?.positionMs || shelfBook?.positionMs || 0;
  const abookId = detail?.abookId ?? shelfBook?.abookId ?? null;

  const handlePlay = (startSec?: number) => {
    void playBook(
      {
        id: bookId,
        abookId,
        title,
        authors,
        narrators,
        coverUrl,
        durationMs,
        positionMs,
      },
      startSec,
    );
  };

  const handleStartDownload = async () => {
    setDlStatus({ downloaded: false, downloading: true, percentage: 0 });
    const res = await fetch(`/api/downloads/${encodeURIComponent(bookId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, abookId }),
    });
    const data = await res.json();
    if (data.downloaded) {
      setDlStatus({ downloaded: true, bytes: data.bytes, downloading: false });
      onDownloadChange();
    }
  };

  const handleDeleteDownload = async () => {
    await fetch(`/api/downloads/${encodeURIComponent(bookId)}`, {
      method: "DELETE",
    });
    setDlStatus({ downloaded: false, downloading: false });
    onDownloadChange();
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBm(true);
    const posMs =
      currentBook?.id === bookId ? Math.round(currentTime * 1000) : positionMs;
    const res = await fetch(`/api/bookmarks/${encodeURIComponent(bookId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionMs: posMs,
        note: newNote.trim() || `Yer imi (${formatTime(posMs / 1000)})`,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDetail((prev) =>
        prev ? { ...prev, bookmarks: data.bookmarks || [] } : prev,
      );
      setNewNote("");
      if (currentBook?.id === bookId) void refreshBookmarks();
    }
    setAddingBm(false);
  };

  const handleDeleteBookmark = async (bmId: string) => {
    const res = await fetch(
      `/api/bookmarks/${encodeURIComponent(bookId)}/${encodeURIComponent(bmId)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setDetail((prev) =>
        prev
          ? { ...prev, bookmarks: prev.bookmarks.filter((b) => b.id !== bmId) }
          : prev,
      );
      if (currentBook?.id === bookId) void refreshBookmarks();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] st-surface border st-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b st-border flex flex-col sm:flex-row gap-5 relative st-bg">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full st-surface border st-border st-muted hover:text-[#FF5500] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative shrink-0 self-center sm:self-start">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={title}
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl object-cover st-cover-shadow"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl st-surface-alt" />
            )}
            <span className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/95 text-[#1A1715] flex items-center justify-center shadow">
              <Headphones className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="min-w-0 flex-1 sm:pr-8">
            <h2 className="font-serif-st text-xl sm:text-2xl font-bold st-ink leading-snug">
              {title}
            </h2>
            {authors && (
              <p className="text-sm font-medium st-ink mt-1">{authors}</p>
            )}
            {narrators && (
              <p className="text-xs st-muted mt-0.5">Seslendiren: {narrators}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              {durationMs > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full st-surface border st-border st-ink font-medium">
                  <Clock className="w-3 h-3 text-[#FF5500]" />
                  {formatDurationMs(durationMs)}
                </span>
              )}
              {(detail?.category || shelfBook?.category) && (
                <span className="px-2.5 py-1 rounded-full st-surface border st-border st-muted font-medium">
                  {detail?.category || shelfBook?.category}
                </span>
              )}
              {(detail?.language || shelfBook?.language) && (
                <span className="px-2.5 py-1 rounded-full st-surface border st-border st-muted font-medium">
                  {getLanguageLabel(
                    detail?.language || shelfBook?.language,
                    detail?.languageName || shelfBook?.languageName,
                  )}
                </span>
              )}
            </div>

            {/* Pill Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => handlePlay()}
                className="px-5 py-2.5 rounded-full st-accent-bg text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#FF5500]/25 transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {positionMs > 0 ? "Dinlemeye Devam Et" : "Dinle"}
              </button>

              <button
                type="button"
                onClick={() => onToggleFavorite(bookId)}
                className={`px-3.5 py-2.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                  shelfBook?.isFavorite
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400"
                    : "st-surface st-border st-ink hover:border-[#FF5500]"
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${shelfBook?.isFavorite ? "fill-current" : ""}`}
                />
                {shelfBook?.isFavorite ? "Beğenildi" : "Beğen"}
              </button>

              {dlStatus.downloaded ? (
                <button
                  type="button"
                  onClick={handleDeleteDownload}
                  className="px-3.5 py-2.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 cursor-pointer"
                  title="İndirilen MP3'ü sil"
                >
                  <Check className="w-3.5 h-3.5" />
                  İndirildi ({formatBytes(dlStatus.bytes)})
                </button>
              ) : dlStatus.downloading ? (
                <button
                  type="button"
                  onClick={handleDeleteDownload}
                  className="px-3.5 py-2.5 rounded-full text-xs font-semibold st-accent-soft text-[#FF5500] flex items-center gap-1.5 cursor-pointer"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  %{dlStatus.percentage ?? 0} (İptal)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartDownload}
                  className="px-3.5 py-2.5 rounded-full text-xs font-semibold st-surface border st-border st-ink hover:border-[#FF5500] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  İndir
                </button>
              )}

              {shelfBook ? (
                <button
                  type="button"
                  disabled={shelfBusy}
                  onClick={async () => {
                    setShelfBusy(true);
                    await onRemoveFromShelf(bookId);
                    setShelfBusy(false);
                  }}
                  className="px-3.5 py-2.5 rounded-full text-xs font-semibold st-surface border st-border st-muted hover:text-red-500 hover:border-red-400 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Çıkar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={shelfBusy}
                  onClick={async () => {
                    setShelfBusy(true);
                    await onAddToShelf(bookId);
                    setShelfBusy(false);
                  }}
                  className="px-3.5 py-2.5 rounded-full text-xs font-semibold st-surface border st-border st-ink hover:border-[#FF5500] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Kitaplığa Ekle
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Groups */}
        {collections.length > 0 && (
          <div className="px-6 py-3 border-b st-border flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold st-muted flex items-center gap-1 mr-1">
              <FolderPlus className="w-3.5 h-3.5" />
              Gruplarım:
            </span>
            {collections.map((col) => {
              const assigned = col.bookIds.includes(bookId);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onToggleCollection(col.id, bookId)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                    assigned
                      ? "st-accent-soft border-[#FF5500]/40 text-[#FF5500]"
                      : "st-bg st-border st-muted hover:st-ink"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  {col.name}
                  {assigned && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-3 border-b st-border flex gap-6 text-xs font-bold">
          {(
            [
              { id: "about", label: t("detail.tabAbout") },
              {
                id: "chapters",
                label: `${t("detail.tabChapters")} (${detail?.chapters.length ?? 0})`,
                icon: ListMusic,
              },
              {
                id: "bookmarks",
                label: `${t("detail.tabBookmarks")} (${detail?.bookmarks.length ?? 0})`,
                icon: Bookmark,
              },
            ] as const
          ).map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`pb-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                tab === tabItem.id
                  ? "border-[#FF5500] text-[#FF5500]"
                  : "border-transparent st-muted hover:st-ink"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 text-[#FF5500] animate-spin" />
            </div>
          ) : tab === "about" ? (
            <div className="text-sm st-ink leading-relaxed whitespace-pre-line">
              {detail?.description || "Bu kitap için açıklama bilgisi bulunamadı."}
            </div>
          ) : tab === "chapters" ? (
            <div className="space-y-1.5">
              {!detail?.chapters.length ? (
                <p className="text-sm st-muted text-center py-8">
                  Bölüm listesi bulunamadı.
                </p>
              ) : (
                detail.chapters.map((ch) => (
                  <button
                    key={ch.index}
                    type="button"
                    onClick={() => handlePlay(ch.startMs / 1000)}
                    className="w-full px-4 py-3 rounded-2xl st-bg hover:border-[#FF5500] border st-border flex items-center justify-between gap-3 text-left transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold st-ink truncate">
                        {ch.title}
                      </div>
                      {ch.durationMs > 0 && (
                        <div className="text-xs st-muted">
                          {formatTime(ch.durationMs / 1000)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-mono st-muted shrink-0">
                      {formatTime(ch.startMs / 1000)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleAddBookmark} className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Mevcut konuma yer imi notu ekle..."
                  className="flex-1 px-4 py-2.5 rounded-full st-bg border st-border text-sm st-ink placeholder:text-[#9A938A] focus:outline-none focus:border-[#FF5500]"
                />
                <button
                  type="submit"
                  disabled={addingBm}
                  className="px-5 py-2.5 rounded-full st-accent-bg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Ekle
                </button>
              </form>

              {!detail?.bookmarks.length ? (
                <p className="text-sm st-muted text-center py-6">
                  Henüz yer imi eklenmemiş.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="px-4 py-3 rounded-2xl st-bg border st-border flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => handlePlay(bm.positionMs / 1000)}
                        className="text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="text-xs font-mono font-bold text-[#FF5500]">
                          {formatTime(bm.positionMs / 1000)}
                        </div>
                        <div className="text-sm st-ink mt-0.5">
                          {bm.note || "Yer imi"}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBookmark(bm.id)}
                        className="p-1.5 st-muted hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
