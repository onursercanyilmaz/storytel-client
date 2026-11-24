"use client";

import React, { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkPlus,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Gauge,
  ListMusic,
  Loader2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { usePlayer } from "./PlayerContext";
import { usePreferences } from "./PreferencesContext";
import { formatTime } from "@/lib/format";
import BookVocabPanel from "./BookVocabPanel";

interface PlayerBarProps {
  onOpenBookDetail: (bookId: string) => void;
}

const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];
const SLEEP_PRESETS = [5, 10, 15, 30, 45, 60];

export default function PlayerBar({ onOpenBookDetail }: PlayerBarProps) {
  const { t } = usePreferences();
  const {
    currentBook,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    chapters,
    activeChapter,
    bookmarks,
    sleepTimer,
    error,
    togglePlay,
    seek,
    skip,
    setPlaybackRate,
    setVolume,
    toggleMute,
    setSleepMinutes,
    setSleepEndOfChapter,
    jumpToChapter,
    addQuickBookmark,
    deleteBookmark,
  } = usePlayer();

  const [expanded, setExpanded] = useState(false);
  const [openSheet, setOpenSheet] = useState<
    "none" | "speed" | "sleep" | "chapters" | "bookmarks" | "vocab"
  >("none");
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [bookVocabCount, setBookVocabCount] = useState<number>(0);

  useEffect(() => {
    if (!currentBook?.id) {
      setBookVocabCount(0);
      return;
    }

    let isMounted = true;
    const fetchCount = async () => {
      try {
        const res = await fetch(
          `/api/vocabulary?bookId=${encodeURIComponent(currentBook.id)}`,
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          setBookVocabCount(
            data.total ?? (Array.isArray(data.words) ? data.words.length : 0),
          );
        }
      } catch {
        // ignore
      }
    };

    fetchCount();

    const handleUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ bookId?: string }>;
      if (!ce.detail?.bookId || ce.detail.bookId === currentBook.id) {
        fetchCount();
      }
    };

    window.addEventListener("vocab-updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("vocab-updated", handleUpdate);
    };
  }, [currentBook?.id]);

  if (!currentBook) return null;

  const progressPct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBookmark(true);
    const ok = await addQuickBookmark(
      bookmarkNote.trim() || `Yer imi (${formatTime(currentTime)})`,
    );
    setSavingBookmark(false);
    if (ok) setBookmarkNote("");
  };

  const toggleSheet = (
    name: "speed" | "sleep" | "chapters" | "bookmarks" | "vocab",
  ) => {
    setOpenSheet((prev) => (prev === name ? "none" : name));
  };

  const renderUtilitySheet = () => {
    if (openSheet === "none") return null;

    if (openSheet === "vocab") {
      return (
        <div
          className={`z-50 ${
            expanded
              ? "fixed bottom-24 left-1/2 -translate-x-1/2"
              : "absolute bottom-full right-4 mb-3"
          }`}
        >
          <BookVocabPanel
            bookId={currentBook.id}
            bookTitle={currentBook.title}
            onClose={() => setOpenSheet("none")}
            isDrawer
          />
        </div>
      );
    }

    return (
      <div
        className={`z-50 w-80 max-w-[calc(100vw-2rem)] rounded-3xl st-surface border st-border shadow-2xl p-5 max-h-[60vh] flex flex-col ${
          expanded
            ? "fixed bottom-24 left-1/2 -translate-x-1/2"
            : "absolute bottom-full right-4 mb-3"
        }`}
      >
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b st-border">
          <h3 className="text-sm font-bold st-ink">
            {openSheet === "speed" && t("player.speed")}
            {openSheet === "sleep" && t("player.sleep")}
            {openSheet === "chapters" && `${t("player.chapters")} (${chapters.length})`}
            {openSheet === "bookmarks" && `${t("player.bookmarks")} (${bookmarks.length})`}
          </h3>
          <button
            type="button"
            onClick={() => setOpenSheet("none")}
            className="st-muted hover:text-[#FF5500] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {openSheet === "speed" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs st-muted">
              <span>0.5x</span>
              <span className="text-lg font-bold text-[#FF5500]">
                {playbackRate.toFixed(2)}x
              </span>
              <span>3.0x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="w-full audio-slider"
            />
            <div className="grid grid-cols-4 gap-1.5">
              {SPEED_PRESETS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    Math.abs(playbackRate - rate) < 0.01
                      ? "st-accent-bg text-white"
                      : "st-surface-alt st-ink hover:opacity-80"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        )}

        {openSheet === "sleep" && (
          <div className="space-y-2.5">
            {sleepTimer.type !== "off" && (
              <button
                type="button"
                onClick={() => setSleepMinutes(null)}
                className="w-full py-2 px-3 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold cursor-pointer"
              >
                Zamanlayıcıyı Kapat
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {SLEEP_PRESETS.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => {
                    setSleepMinutes(min);
                    setOpenSheet("none");
                  }}
                  className="py-2 rounded-full st-surface-alt st-ink hover:text-[#FF5500] text-xs font-semibold transition cursor-pointer"
                >
                  {min} dk
                </button>
              ))}
            </div>
            {activeChapter && (
              <button
                type="button"
                onClick={() => {
                  setSleepEndOfChapter();
                  setOpenSheet("none");
                }}
                className={`w-full py-2.5 px-4 rounded-full text-xs font-semibold transition cursor-pointer ${
                  sleepTimer.type === "end_of_chapter"
                    ? "st-accent-bg text-white"
                    : "st-surface-alt st-ink hover:text-[#FF5500]"
                }`}
              >
                Bölüm Sonunda Durdur
              </button>
            )}
          </div>
        )}

        {openSheet === "chapters" && (
          <div className="overflow-y-auto space-y-1 pr-1">
            {chapters.length === 0 ? (
              <p className="text-xs st-muted py-5 text-center">
                Bu kitap için bölüm bilgisi bulunamadı.
              </p>
            ) : (
              chapters.map((ch) => {
                const isActive = activeChapter?.index === ch.index;
                return (
                  <button
                    key={ch.index}
                    type="button"
                    onClick={() => jumpToChapter(ch)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                      isActive
                        ? "st-accent-soft text-[#FF5500] font-semibold"
                        : "hover:bg-black/5 dark:hover:bg-white/5 st-ink"
                    }`}
                  >
                    <span className="truncate">{ch.title}</span>
                    <span className="text-[11px] st-muted shrink-0 font-mono">
                      {formatTime(ch.startMs / 1000)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {openSheet === "bookmarks" && (
          <div className="flex flex-col gap-3 min-h-0">
            <form onSubmit={handleAddBookmark} className="flex gap-1.5">
              <input
                type="text"
                value={bookmarkNote}
                onChange={(e) => setBookmarkNote(e.target.value)}
                placeholder={`Not ekle (${formatTime(currentTime)})...`}
                className="flex-1 px-3 py-2 rounded-full st-bg border st-border text-xs st-ink placeholder:text-[#9A938A] focus:outline-none focus:border-[#FF5500]"
              />
              <button
                type="submit"
                disabled={savingBookmark}
                className="px-3 py-2 rounded-full st-accent-bg text-white text-xs font-semibold flex items-center cursor-pointer disabled:opacity-50"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
              </button>
            </form>
            <div className="overflow-y-auto space-y-1.5 pr-1 max-h-56">
              {bookmarks.length === 0 ? (
                <p className="text-xs st-muted py-4 text-center">
                  Henüz yer imi eklenmedi.
                </p>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl st-bg border st-border"
                  >
                    <button
                      type="button"
                      onClick={() => seek(bm.positionMs / 1000)}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="text-xs font-mono font-semibold text-[#FF5500]">
                        {formatTime(bm.positionMs / 1000)}
                      </div>
                      <div className="text-xs st-ink truncate">
                        {bm.note || "Yer imi"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBookmark(bm.id)}
                      className="st-muted hover:text-red-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Storytel Mobile-Style Full-Screen Expanded Player
  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 st-bg flex flex-col overflow-hidden">
        {/* Soft ambient tint from cover */}
        {currentBook.coverUrl && (
          <div
            className="pointer-events-none absolute inset-0 opacity-15 dark:opacity-25 blur-3xl scale-125 bg-center bg-cover"
            style={{ backgroundImage: `url(${currentBook.coverUrl})` }}
          />
        )}

        {/* Top Header */}
        <div className="relative z-10 px-6 py-5 flex items-center justify-between max-w-2xl w-full mx-auto">
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setOpenSheet("none");
            }}
            className="p-2 rounded-full st-surface border st-border st-ink hover:text-[#FF5500] transition cursor-pointer"
            title="Küçült"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <div className="text-center min-w-0 px-4">
            <div className="text-[11px] uppercase tracking-widest font-semibold st-muted">
              Şimdi Dinleniyor
            </div>
            {activeChapter && (
              <div className="text-xs font-medium st-ink truncate mt-0.5">
                {activeChapter.title}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              onOpenBookDetail(currentBook.id);
            }}
            className="px-3.5 py-1.5 rounded-full st-surface border st-border text-xs font-semibold st-ink hover:text-[#FF5500] transition cursor-pointer"
          >
            Kitap Detayı
          </button>
        </div>

        {/* Center Cover & Controls */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-lg w-full mx-auto">
          {currentBook.coverUrl ? (
            <img
              src={currentBook.coverUrl}
              alt={currentBook.title}
              className="w-60 h-60 sm:w-72 sm:h-72 rounded-2xl object-cover st-cover-shadow mb-8"
            />
          ) : (
            <div className="w-60 h-60 rounded-2xl st-surface-alt mb-8" />
          )}

          <h2 className="font-serif-st text-2xl font-bold st-ink text-center leading-snug line-clamp-2">
            {currentBook.title}
          </h2>
          <p className="text-sm st-muted mt-1 text-center">
            {currentBook.authors}
          </p>
          {error && (
            <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
          )}

          {/* Scrubber */}
          <div className="w-full mt-8 space-y-2">
            <div className="relative flex items-center h-4">
              <div className="w-full h-1.5 st-surface-alt rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF5500] rounded-full transition-[width] duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={1}
                value={Math.min(currentTime, duration || 100)}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-xs font-mono st-muted tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
            </div>
          </div>

          {/* Big Storytel Playback Controls */}
          <div className="flex items-center justify-center gap-8 mt-6">
            <button
              type="button"
              onClick={() => skip(-15)}
              className="p-3 st-ink hover:text-[#FF5500] transition relative cursor-pointer"
              title="15 sn geri"
            >
              <RotateCcw className="w-7 h-7" />
              <span className="text-[10px] font-bold absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                15
              </span>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-16 h-16 rounded-full st-accent-bg text-white flex items-center justify-center shadow-xl shadow-[#FF5500]/35 transition hover:scale-105 cursor-pointer"
            >
              {isBuffering ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>

            <button
              type="button"
              onClick={() => skip(15)}
              className="p-3 st-ink hover:text-[#FF5500] transition relative cursor-pointer"
              title="15 sn ileri"
            >
              <RotateCw className="w-7 h-7" />
              <span className="text-[10px] font-bold absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                15
              </span>
            </button>
          </div>
        </div>

        {/* Classic Storytel 5-Button Bottom Bar */}
        <div className="relative z-10 max-w-lg w-full mx-auto px-6 pb-8 pt-4">
          <div className="grid grid-cols-5 gap-1.5 st-surface border st-border rounded-full p-2 shadow-lg">
            <button
              type="button"
              onClick={() => toggleSheet("speed")}
              className={`py-2 rounded-full flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer ${
                openSheet === "speed" || playbackRate !== 1
                  ? "text-[#FF5500]"
                  : "st-muted hover:text-[#FF5500]"
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>{playbackRate}x</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSheet("sleep")}
              className={`py-2 rounded-full flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer ${
                openSheet === "sleep" || sleepTimer.type !== "off"
                  ? "text-[#FF5500]"
                  : "st-muted hover:text-[#FF5500]"
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>
                {sleepTimer.type === "countdown"
                  ? formatTime(sleepTimer.remainingSec)
                  : sleepTimer.type === "end_of_chapter"
                    ? "Bölüm"
                    : "Uyku"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleSheet("chapters")}
              className={`py-2 rounded-full flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer ${
                openSheet === "chapters"
                  ? "text-[#FF5500]"
                  : "st-muted hover:text-[#FF5500]"
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span>Bölümler</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSheet("bookmarks")}
              className={`py-2 rounded-full flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer ${
                openSheet === "bookmarks"
                  ? "text-[#FF5500]"
                  : "st-muted hover:text-[#FF5500]"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Yer İmi</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSheet("vocab")}
              className={`py-2 rounded-full flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer relative ${
                openSheet === "vocab"
                  ? "text-[#FF5500]"
                  : "st-muted hover:text-[#FF5500]"
              }`}
            >
              <div className="relative">
                <BookMarked className="w-4 h-4" />
                {bookVocabCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-[#FF5500] text-white text-[9px] font-black flex items-center justify-center">
                    {bookVocabCount}
                  </span>
                )}
              </div>
              <span>Kelimeler</span>
            </button>
          </div>
        </div>

        {renderUtilitySheet()}
      </div>
    );
  }

  // Mini Persistent Bottom Bar
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 st-surface border-t st-border shadow-[0_-6px_28px_rgba(0,0,0,0.08)]">
      {renderUtilitySheet()}

      {/* Slim Storytel Orange Progress Line */}
      <div className="relative h-1.5 st-surface-alt group">
        <div
          className="h-full bg-[#FF5500] transition-[width] duration-150"
          style={{ width: `${progressPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={1}
          value={Math.min(currentTime, duration || 100)}
          onChange={(e) => seek(parseFloat(e.target.value))}
          aria-label="Oynatma konumu"
          className="absolute -top-2 inset-x-0 h-5 w-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Book Info + Expand */}
        <div className="flex items-center gap-3 min-w-0 w-1/3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="relative shrink-0 group cursor-pointer"
            title="Tam ekran oynatıcıyı aç"
          >
            {currentBook.coverUrl ? (
              <img
                src={currentBook.coverUrl}
                alt={currentBook.title}
                className="w-12 h-12 rounded-xl object-cover st-cover-shadow"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl st-surface-alt" />
            )}
            <span className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
              <ChevronUp className="w-5 h-5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="min-w-0 text-left cursor-pointer"
          >
            <div className="text-sm font-bold st-ink truncate hover:text-[#FF5500] transition">
              {currentBook.title}
            </div>
            <div className="text-xs st-muted truncate">
              {activeChapter ? activeChapter.title : currentBook.authors}
            </div>
            <div className="text-[11px] font-mono st-muted tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </button>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => skip(-15)}
            className="p-2 st-ink hover:text-[#FF5500] transition relative cursor-pointer"
            title="15 sn geri"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-[9px] font-bold absolute -bottom-0.5 left-1/2 -translate-x-1/2">
              15
            </span>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="w-11 h-11 rounded-full st-accent-bg text-white flex items-center justify-center shadow-md shadow-[#FF5500]/30 transition hover:scale-105 cursor-pointer"
          >
            {isBuffering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => skip(15)}
            className="p-2 st-ink hover:text-[#FF5500] transition relative cursor-pointer"
            title="15 sn ileri"
          >
            <RotateCw className="w-5 h-5" />
            <span className="text-[9px] font-bold absolute -bottom-0.5 left-1/2 -translate-x-1/2">
              15
            </span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center justify-end gap-1 sm:gap-2 w-1/3">
          <button
            type="button"
            onClick={() => toggleSheet("speed")}
            className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              openSheet === "speed" || playbackRate !== 1
                ? "st-accent-soft text-[#FF5500]"
                : "st-muted hover:text-[#FF5500]"
            }`}
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={() => toggleSheet("sleep")}
            className={`p-2 rounded-full transition cursor-pointer ${
              openSheet === "sleep" || sleepTimer.type !== "off"
                ? "st-accent-soft text-[#FF5500]"
                : "st-muted hover:text-[#FF5500]"
            }`}
            title="Uyku zamanlayıcısı"
          >
            <Moon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => toggleSheet("chapters")}
            className={`p-2 rounded-full transition cursor-pointer ${
              openSheet === "chapters"
                ? "st-accent-soft text-[#FF5500]"
                : "st-muted hover:text-[#FF5500]"
            }`}
            title="Bölümler"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => toggleSheet("bookmarks")}
            className={`p-2 rounded-full transition cursor-pointer ${
              openSheet === "bookmarks"
                ? "st-accent-soft text-[#FF5500]"
                : "st-muted hover:text-[#FF5500]"
            }`}
            title="Yer İmleri"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => toggleSheet("vocab")}
            className={`p-2 rounded-full transition cursor-pointer relative ${
              openSheet === "vocab"
                ? "st-accent-soft text-[#FF5500]"
                : "st-muted hover:text-[#FF5500]"
            }`}
            title={`Kitabın Kelimeleri (${bookVocabCount})`}
          >
            <BookMarked className="w-4 h-4" />
            {bookVocabCount > 0 && (
              <span className="absolute top-0.5 right-0.5 px-1 min-w-[14px] h-3.5 rounded-full bg-[#FF5500] text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                {bookVocabCount}
              </span>
            )}
          </button>

          <div className="hidden md:flex items-center gap-1.5 ml-1">
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 st-muted hover:text-[#FF5500] cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 audio-slider"
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="p-2 rounded-full st-muted hover:text-[#FF5500] cursor-pointer"
            title="Tam ekran oynatıcı"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
