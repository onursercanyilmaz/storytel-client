"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkPlus,
  BookMarked,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Headphones,
  Highlighter,
  Link2,
  Link2Off,
  ListMusic,
  Loader2,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import type { BookHighlight, BookshelfBook, HighlightColor } from "@/lib/storytel/types";
import type { ParsedEbook } from "@/lib/epub-parser";
import { toPlayingBook, usePlayer } from "./PlayerContext";
import { usePreferences } from "./PreferencesContext";
import { formatTime, formatBytes } from "@/lib/format";
import BookVocabPanel from "./BookVocabPanel";

interface ReadAndListenViewProps {
  book: BookshelfBook;
  initialReaderOnly?: boolean;
  onClose: () => void;
}

// Memoized so audio timeupdate ticks and vocab popup state NEVER wipe
// innerHTML and destroy the user's active text selection!
const EbookChapterBody = React.memo(function EbookChapterBody({
  html,
}: {
  html: string;
}) {
  return (
    <div
      className="ebook-prose [&_p]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[#FF5500] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:opacity-85"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

type ReaderTheme = "dark" | "sepia" | "light";

const READER_THEMES: Record<
  ReaderTheme,
  { bg: string; text: string; border: string; labelTr: string; labelEn: string }
> = {
  dark: {
    bg: "#101012",
    text: "#E6E4E0",
    border: "#252529",
    labelTr: "Koyu",
    labelEn: "Dark",
  },
  sepia: {
    bg: "#F5EFE0",
    text: "#2C241B",
    border: "#E2D6BE",
    labelTr: "Sepya",
    labelEn: "Sepia",
  },
  light: {
    bg: "#FFFFFF",
    text: "#18181B",
    border: "#E4E4E7",
    labelTr: "Açık",
    labelEn: "Light",
  },
};

export default function ReadAndListenView({
  book,
  initialReaderOnly = false,
  onClose,
}: ReadAndListenViewProps) {
  const { lang } = usePreferences();
  const hasAudio = !!book.abookId || book.durationMs > 0;
  const [showAudioPane, setShowAudioPane] = useState(
    hasAudio && !initialReaderOnly,
  );
  const {
    currentBook,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    playbackRate,
    chapters: audioChapters,
    activeChapter: activeAudioChapter,
    bookmarks,
    sleepTimer,
    error: audioError,
    playBook,
    togglePlay,
    seek,
    skip,
    setPlaybackRate,
    setSleepMinutes,
    setSleepEndOfChapter,
    jumpToChapter,
    addQuickBookmark,
    deleteBookmark,
  } = usePlayer();

  // E-book state (Storytel EPUB, local EPUB, or local PDF)
  const [ebook, setEbook] = useState<ParsedEbook | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [localPdfName, setLocalPdfName] = useState<string | null>(null);
  const [ebookLoading, setEbookLoading] = useState(true);
  const [ebookError, setEbookError] = useState<string | null>(null);
  const [chapterIdx, setChapterIdx] = useState(0);

  useEffect(() => {
    return () => {
      if (localPdfUrl) URL.revokeObjectURL(localPdfUrl);
    };
  }, [localPdfUrl]);

  // Reader appearance
  const [fontSize, setFontSize] = useState(18);
  const [useSerif, setUseSerif] = useState(true);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>("sepia");
  const [autoSync, setAutoSync] = useState(true);

  // Right pane tabs & vocabulary slide-over
  const [sideTab, setSideTab] = useState<"chapters" | "bookmarks" | "vocab" | "highlights">("chapters");
  const [bmNote, setBmNote] = useState("");
  const [savingBm, setSavingBm] = useState(false);
  const [showVocabPanel, setShowVocabPanel] = useState(false);
  const [bookVocabCount, setBookVocabCount] = useState<number>(0);
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [highlightDraft, setHighlightDraft] = useState<{
    text: string;
    note: string;
    color: HighlightColor;
    saving: boolean;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadHighlights = async () => {
      try {
        const res = await fetch(`/api/highlights?bookId=${encodeURIComponent(book.id)}`);
        if (res.ok && mounted) {
          const data = await res.json();
          setHighlights(data.highlights || []);
        }
      } catch {}
    };
    void loadHighlights();
    window.addEventListener("profile-switched", loadHighlights);
    return () => {
      mounted = false;
      window.removeEventListener("profile-switched", loadHighlights);
    };
  }, [book.id]);

  useEffect(() => {
    let isMounted = true;
    const fetchCount = async () => {
      try {
        const res = await fetch(
          `/api/vocabulary?bookId=${encodeURIComponent(book.id)}`,
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
      if (!ce.detail?.bookId || ce.detail.bookId === book.id) {
        fetchCount();
      }
    };
    window.addEventListener("vocab-updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("vocab-updated", handleUpdate);
    };
  }, [book.id]);

  // Quick Vocabulary Capture (highlight in EPUB or click "+ Kelime" for PDF/audio)
  const [vocabDraft, setVocabDraft] = useState<{
    word: string;
    meaning: string;
    phonetic: string;
    context: string;
    from: string;
    to: string;
    loading: boolean;
    saved: boolean;
  } | null>(null);

  const speakWord = (word: string, langCode: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = langCode || (book.language ? book.language.slice(0, 2) : "en");
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore
    }
  };

  const openVocabLookup = async (
    word: string,
    context = "",
    customTo?: string,
  ) => {
    const clean = word
      .trim()
      .replace(/^[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ'-]+|[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ'-]+$/g, "");
    if (!clean || clean.length > 80) return;

    const fromLang = (book.language || "en").toLowerCase();
    const defaultTo = customTo || (fromLang.startsWith("tr") ? "en" : "tr");

    setVocabDraft({
      word: clean,
      meaning: "",
      phonetic: "",
      context,
      from: fromLang,
      to: defaultTo,
      loading: true,
      saved: false,
    });

    try {
      const res = await fetch(
        `/api/vocabulary/lookup?word=${encodeURIComponent(clean)}&from=${encodeURIComponent(fromLang)}&to=${encodeURIComponent(defaultTo)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        setVocabDraft((prev) =>
          prev
            ? {
                ...prev,
                meaning: data.meaning || data.translation || data.definition || "",
                phonetic: data.phonetic || "",
                from: data.from || fromLang,
                to: data.to || defaultTo,
                loading: false,
              }
            : null,
        );
        return;
      }
    } catch {
      // ignore lookup error
    }
    setVocabDraft((prev) => (prev ? { ...prev, loading: false } : null));
  };

  const handleTextSelection = () => {
    // Wait 15ms so browser finalizes double-click / drag selection
    setTimeout(() => {
      const sel = window.getSelection();
      const selected = sel?.toString().trim() || "";
      if (!selected || selected.length < 2) return;

      const wordCount = selected.split(/\s+/).length;
      if (wordCount <= 4 && selected.length <= 50) {
        const anchorText = sel?.anchorNode?.textContent || "";
        const context = anchorText.trim().slice(0, 220);
        void openVocabLookup(selected, context);
      } else if (selected.length <= 1800) {
        setHighlightDraft({
          text: selected,
          note: "",
          color: "yellow",
          saving: false,
        });
      }
    }, 15);
  };

  const handleSaveHighlightDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highlightDraft || !highlightDraft.text.trim()) return;
    setHighlightDraft((prev) => (prev ? { ...prev, saving: true } : null));
    try {
      const res = await fetch("/api/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          bookTitle: book.title,
          chapterIndex: chapterIdx,
          chapterTitle: ebook?.chapters[chapterIdx]?.title || undefined,
          text: highlightDraft.text,
          note: highlightDraft.note.trim() || undefined,
          color: highlightDraft.color,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.entry) setHighlights((prev) => [data.entry, ...prev]);
        setHighlightDraft(null);
      }
    } catch {
      setHighlightDraft((prev) => (prev ? { ...prev, saving: false } : null));
    }
  };

  const handleDeleteHighlight = async (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    await fetch(`/api/highlights?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  };

  const handleExportHighlightsMd = () => {
    const lines = [
      `# ${book.title} — Alıntılar & Notlar`,
      "",
      ...highlights.map((h) => {
        const ch = h.chapterTitle ? ` (${h.chapterTitle})` : "";
        const noteLine = h.note ? `\n> **Not:** ${h.note}` : "";
        return `### ${h.color.toUpperCase()}${ch}\n> "${h.text}"${noteLine}\n`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book.title.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ _-]/g, "_")}-notlar.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveVocabDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vocabDraft || !vocabDraft.word.trim()) return;
    const res = await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: vocabDraft.word.trim(),
        meaning: vocabDraft.meaning.trim(),
        phonetic: vocabDraft.phonetic.trim() || undefined,
        context: vocabDraft.context.trim() || undefined,
        bookId: book.id,
        bookTitle: book.title,
      }),
    });
    if (res.ok) {
      setVocabDraft((prev) => (prev ? { ...prev, saved: true } : null));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("vocab-updated", { detail: { bookId: book.id } }),
        );
      }
      setTimeout(() => setVocabDraft(null), 900);
    }
  };

  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isSameAudioBook = currentBook?.id === book.id;

  // Start or resume audio only when this book actually has an audiobook & audio pane is active
  useEffect(() => {
    if (hasAudio && showAudioPane && !isSameAudioBook) {
      void playBook(toPlayingBook(book));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, hasAudio]);

  // Fetch Storytel EPUB
  useEffect(() => {
    let active = true;
    setEbookLoading(true);
    setEbookError(null);
    setEbook(null);
    setChapterIdx(0);

    if (!book.hasEbook && !book.ebookId) {
      setEbookLoading(false);
      setEbookError(
        lang === "tr"
          ? "Bu eserin Storytel üzerinde e-kitap sürümü bulunmuyor. Dilerseniz kendi .epub veya .pdf dosyanızı yükleyerek sesli kitapla birlikte okuyabilirsiniz."
          : "This title does not have an e-book on Storytel. You can upload your own .epub or .pdf file to read along with the audiobook.",
      );
      return;
    }

    const qs = book.ebookId
      ? `?ebookId=${encodeURIComponent(book.ebookId)}`
      : "";
    fetch(`/api/ebook/${encodeURIComponent(book.id)}${qs}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setEbookError(data.error || "E-kitap yüklenemedi.");
          return;
        }
        setEbook(data);
      })
      .catch(() => {
        if (active) setEbookError("E-kitap sunucusuna ulaşılamadı.");
      })
      .finally(() => {
        if (active) setEbookLoading(false);
      });

    return () => {
      active = false;
    };
  }, [book.id, book.ebookId]);

  // Cumulative character offsets per e-book chapter for Audio <-> Ebook Sync
  const chapterRanges = useMemo(() => {
    if (!ebook || ebook.totalChars <= 0) return [];
    let acc = 0;
    return ebook.chapters.map((ch) => {
      const startRatio = acc / ebook.totalChars;
      acc += ch.charCount;
      const endRatio = acc / ebook.totalChars;
      return { index: ch.index, startRatio, endRatio };
    });
  }, [ebook]);

  // Auto-sync e-book chapter & scroll position with live audio playback
  useEffect(() => {
    if (
      !autoSync ||
      !ebook ||
      !isSameAudioBook ||
      !duration ||
      duration <= 0 ||
      chapterRanges.length === 0
    ) {
      return;
    }

    const ratio = Math.max(0, Math.min(1, currentTime / duration));
    const match =
      chapterRanges.find((r) => ratio >= r.startRatio && ratio <= r.endRatio) ??
      chapterRanges[chapterRanges.length - 1];

    if (match && match.index !== chapterIdx) {
      setChapterIdx(match.index);
    }

    if (match && readerScrollRef.current) {
      const el = readerScrollRef.current;
      const span = Math.max(0.0001, match.endRatio - match.startRatio);
      const inChapterRatio = Math.max(
        0,
        Math.min(1, (ratio - match.startRatio) / span),
      );
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const targetTop = Math.round(maxScroll * inChapterRatio);
      if (Math.abs(el.scrollTop - targetTop) > 40) {
        el.scrollTo({ top: targetTop, behavior: "smooth" });
      }
    }
  }, [autoSync, ebook, isSameAudioBook, currentTime, duration, chapterRanges, chapterIdx]);

  // Upload local .epub or .pdf fallback
  const handleLocalFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEbookError(null);

    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      if (localPdfUrl) URL.revokeObjectURL(localPdfUrl);
      const blobUrl = URL.createObjectURL(file);
      setEbook(null);
      setLocalPdfUrl(blobUrl);
      setLocalPdfName(file.name);
      setEbookLoading(false);
      e.target.value = "";
      return;
    }

    setEbookLoading(true);
    if (localPdfUrl) {
      URL.revokeObjectURL(localPdfUrl);
      setLocalPdfUrl(null);
      setLocalPdfName(null);
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ebook/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setEbookError(data.error || "EPUB dosyası okunamadı.");
        return;
      }
      setEbook(data);
      setChapterIdx(0);
    } catch {
      setEbookError("Dosya yüklenirken hata oluştu.");
    } finally {
      setEbookLoading(false);
      e.target.value = "";
    }
  };

  const activeTheme = READER_THEMES[readerTheme];
  const currentChapter = ebook?.chapters[chapterIdx] ?? null;
  const progressPct =
    isSameAudioBook && duration > 0
      ? Math.min(100, (currentTime / duration) * 100)
      : 0;

  const handleAddBm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBm(true);
    const ok = await addQuickBookmark(
      bmNote.trim() || `Yer imi (${formatTime(currentTime)})`,
    );
    setSavingBm(false);
    if (ok) setBmNote("");
  };

  return (
    <div className="fixed inset-0 z-50 st-bg flex flex-col overflow-hidden">
      {/* Top Studio Toolbar */}
      <header className="h-14 shrink-0 st-surface border-b st-border px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full st-bg border st-border hover:border-[#FF5500] text-xs font-bold st-ink flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {lang === "tr" ? "Kitaplığa Dön" : "Back"}
          </button>

          <div className="min-w-0 hidden sm:block">
            <div className="text-sm font-bold st-ink truncate flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full st-accent-soft text-[#FF5500] text-[10px] font-bold uppercase tracking-wider shrink-0">
                {lang === "tr" ? "Oku & Dinle" : "Read & Listen"}
              </span>
              <span className="truncate">{book.title}</span>
            </div>
          </div>
        </div>

        {/* Reader Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          {/* Toggle Audio Side Pane (allows full-width E-Book Reader mode!) */}
          {hasAudio && (
            <button
              type="button"
              onClick={() => setShowAudioPane((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
                showAudioPane
                  ? "st-accent-soft border-[#FF5500]/40 text-[#FF5500]"
                  : "st-bg st-border st-muted hover:st-ink"
              }`}
              title={
                lang === "tr"
                  ? "Sesli kitap panelini aç/kapat"
                  : "Toggle audiobook side panel"
              }
            >
              <Headphones className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {showAudioPane
                  ? lang === "tr"
                    ? "Ses Paneli Açık"
                    : "Audio On"
                  : lang === "tr"
                    ? "Sadece Oku"
                    : "Reader Only"}
              </span>
            </button>
          )}

          {/* Audio Sync Toggle */}
          {hasAudio && showAudioPane && (
            <button
              type="button"
              onClick={() => setAutoSync((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
                autoSync
                  ? "st-accent-soft border-[#FF5500]/40 text-[#FF5500]"
                  : "st-bg st-border st-muted"
              }`}
              title={
                lang === "tr"
                  ? "Sesli kitap ilerledikçe e-kitabı otomatik kaydır"
                  : "Auto-scroll e-book with audio progress"
              }
            >
              {autoSync ? (
                <Link2 className="w-3.5 h-3.5" />
              ) : (
                <Link2Off className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">
                {lang === "tr" ? "Sesle Takip" : "Audio Sync"}
              </span>
            </button>
          )}

          {/* Font Size */}
          <div className="flex items-center rounded-full st-bg border st-border overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(13, s - 2))}
              className="px-2 py-1.5 st-muted hover:st-ink cursor-pointer"
              title="Küçült"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold st-ink px-1">
              {fontSize}
            </span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(28, s + 2))}
              className="px-2 py-1.5 st-muted hover:st-ink cursor-pointer"
              title="Büyüt"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Serif / Sans */}
          <button
            type="button"
            onClick={() => setUseSerif((v) => !v)}
            className="px-2.5 py-1.5 rounded-full st-bg border st-border text-xs font-bold st-ink hover:border-[#FF5500] cursor-pointer shrink-0"
          >
            {useSerif ? "Serif" : "Sans"}
          </button>

          {/* Reader Theme */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-full st-bg border st-border shrink-0">
            {(["dark", "sepia", "light"] as ReaderTheme[]).map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => setReaderTheme(th)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  readerTheme === th
                    ? "st-accent-bg text-white"
                    : "st-muted hover:st-ink"
                }`}
              >
                {lang === "tr"
                  ? READER_THEMES[th].labelTr
                  : READER_THEMES[th].labelEn}
              </button>
            ))}
          </div>

          {/* Book Vocabulary Panel Toggle */}
          <button
            type="button"
            onClick={() => setShowVocabPanel((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
              showVocabPanel
                ? "st-accent-soft border-[#FF5500]/40 text-[#FF5500]"
                : "st-bg st-border st-muted hover:st-ink"
            }`}
            title={
              lang === "tr"
                ? "Bu kitaba ait kelimeleri sağ panelde aç"
                : "Open words for this book in side panel"
            }
          >
            <BookMarked className="w-3.5 h-3.5 text-[#FF5500]" />
            <span>{lang === "tr" ? "Kelimeler" : "Words"}</span>
            {bookVocabCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#FF5500] text-white text-[10px] font-extrabold">
                {bookVocabCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setVocabDraft({
                word: "",
                meaning: "",
                phonetic: "",
                context: "",
                from: (book.language || "en").toLowerCase(),
                to: (book.language || "en").toLowerCase().startsWith("tr")
                  ? "en"
                  : "tr",
                loading: false,
                saved: false,
              })
            }
            className="px-2.5 py-1.5 rounded-full st-accent-soft border border-[#FF5500]/40 text-[#FF5500] hover:bg-[#FF5500] hover:text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
            title={
              lang === "tr"
                ? "Kelime Defterine Hızlı Kelime Kaydet"
                : "Quick save word to Vocabulary"
            }
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">
              {lang === "tr" ? "Kelime Ekle" : "Add Word"}
            </span>
          </button>

          {/* EPUB Download */}
          {(book.hasEbook || book.ebookId) && (
            <a
              href={`/api/ebook/${encodeURIComponent(book.id)}/download?ebookId=${book.ebookId || ""}`}
              download
              className="px-3 py-1.5 rounded-full st-bg border st-border hover:border-emerald-500 hover:text-emerald-500 text-xs font-semibold st-ink flex items-center gap-1.5 transition cursor-pointer shrink-0"
              title={lang === "tr" ? "EPUB dosyasını bilgisayarına indir" : "Download EPUB file"}
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">
                {ebook?.fileBytes
                  ? `EPUB (${formatBytes(ebook.fileBytes)})`
                  : book.ebookBytes
                    ? `EPUB (${formatBytes(book.ebookBytes)})`
                    : "EPUB"}
              </span>
            </a>
          )}

          {/* PDF / Print */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-full st-bg border st-border hover:border-[#FF5500] text-xs font-semibold st-ink flex items-center gap-1.5 transition cursor-pointer shrink-0"
            title={lang === "tr" ? "PDF Olarak Kaydet veya Yazdır" : "Print or Save as PDF"}
          >
            <Printer className="w-3.5 h-3.5 text-[#FF5500]" />
            <span className="hidden xl:inline">PDF</span>
          </button>

          {/* Local .epub / .pdf Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,.pdf,application/pdf,application/epub+zip"
            onChange={handleLocalFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-full st-bg border st-border hover:border-[#FF5500] text-xs font-semibold st-ink flex items-center gap-1.5 transition cursor-pointer shrink-0"
            title={
              lang === "tr"
                ? "Bilgisayarından .pdf veya .epub yükle"
                : "Load local .pdf or .epub file"
            }
          >
            <Upload className="w-3.5 h-3.5 text-[#FF5500]" />
            <span className="hidden lg:inline">PDF / EPUB</span>
          </button>
        </div>
      </header>

      {/* Split Workspace: Full-width Reader when audio pane hidden, or 65% Reader | 35% Audio */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT PANE: E-BOOK READER */}
        <section
          className={`${showAudioPane ? "lg:col-span-8 border-r" : "lg:col-span-12"} flex flex-col min-h-0`}
          style={{
            backgroundColor: activeTheme.bg,
            color: activeTheme.text,
            borderColor: activeTheme.border,
          }}
        >
          {/* Chapter Selector Bar */}
          {ebook && ebook.chapters.length > 0 && (
            <div
              className="px-6 py-2.5 border-b flex items-center justify-between gap-3 shrink-0"
              style={{ borderColor: activeTheme.border }}
            >
              <button
                type="button"
                disabled={chapterIdx <= 0}
                onClick={() => {
                  setAutoSync(false);
                  setChapterIdx((i) => Math.max(0, i - 1));
                  readerScrollRef.current?.scrollTo({ top: 0 });
                }}
                className="p-1.5 rounded-lg border disabled:opacity-30 cursor-pointer"
                style={{ borderColor: activeTheme.border }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={chapterIdx}
                onChange={(e) => {
                  setAutoSync(false);
                  setChapterIdx(parseInt(e.target.value, 10));
                  readerScrollRef.current?.scrollTo({ top: 0 });
                }}
                className="max-w-md w-full px-3 py-1.5 rounded-lg text-xs font-semibold border bg-transparent focus:outline-none"
                style={{
                  borderColor: activeTheme.border,
                  color: activeTheme.text,
                }}
              >
                {ebook.chapters.map((ch) => (
                  <option
                    key={ch.index}
                    value={ch.index}
                    style={{ backgroundColor: "#141414", color: "#f5f5f5" }}
                  >
                    {ch.index + 1}. {ch.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={chapterIdx >= ebook.chapters.length - 1}
                onClick={() => {
                  setAutoSync(false);
                  setChapterIdx((i) =>
                    Math.min(ebook.chapters.length - 1, i + 1),
                  );
                  readerScrollRef.current?.scrollTo({ top: 0 });
                }}
                className="p-1.5 rounded-lg border disabled:opacity-30 cursor-pointer"
                style={{ borderColor: activeTheme.border }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Scrollable Book Text or Native PDF Viewer */}
          {localPdfUrl ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div
                className="px-4 py-2 border-b text-xs flex items-center justify-between"
                style={{ borderColor: activeTheme.border }}
              >
                <span className="font-semibold truncate">{localPdfName}</span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(localPdfUrl);
                    setLocalPdfUrl(null);
                    setLocalPdfName(null);
                  }}
                  className="text-[#FF5500] font-bold hover:underline cursor-pointer shrink-0 ml-3"
                >
                  {lang === "tr" ? "PDF'i Kapat" : "Close PDF"}
                </button>
              </div>
              <iframe
                src={localPdfUrl}
                title={localPdfName || "PDF"}
                className="flex-1 w-full h-full border-0 bg-zinc-900"
              />
            </div>
          ) : (
          <div
            ref={readerScrollRef}
            onMouseUp={handleTextSelection}
            onDoubleClick={handleTextSelection}
            className="flex-1 overflow-y-auto px-6 sm:px-12 py-10"
          >
            {ebookLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 opacity-70">
                <Loader2 className="w-7 h-7 text-[#FF5500] animate-spin" />
                <p className="text-sm font-medium">
                  {lang === "tr"
                    ? "E-kitap hazırlanıyor..."
                    : "Loading e-book..."}
                </p>
              </div>
            ) : ebookError ? (
              <div className="max-w-md mx-auto py-16 text-center space-y-4">
                <BookOpen className="w-11 h-11 text-[#FF5500] mx-auto opacity-80" />
                <h3 className="text-lg font-bold">
                  {lang === "tr"
                    ? "E-kitap Açılamadı"
                    : "E-book Could Not Be Loaded"}
                </h3>
                <p className="text-sm opacity-75 leading-relaxed">
                  {ebookError}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-full st-accent-bg text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Upload className="w-4 h-4" />
                  {lang === "tr"
                    ? "Bilgisayardan PDF veya EPUB Yükle"
                    : "Load Local PDF or EPUB"}
                </button>
              </div>
            ) : currentChapter ? (
              <article
                className={`max-w-2xl mx-auto leading-[1.85] space-y-4 ${
                  useSerif ? "font-serif-st" : "font-sans"
                }`}
                style={{ fontSize: `${fontSize}px` }}
              >
                <EbookChapterBody html={currentChapter.html} />

                {/* Bottom Chapter Navigation */}
                <div
                  className="pt-8 mt-10 border-t flex items-center justify-between text-xs font-bold"
                  style={{ borderColor: activeTheme.border }}
                >
                  <button
                    type="button"
                    disabled={chapterIdx <= 0}
                    onClick={() => {
                      setAutoSync(false);
                      setChapterIdx((i) => Math.max(0, i - 1));
                      readerScrollRef.current?.scrollTo({ top: 0 });
                    }}
                    className="px-4 py-2 rounded-full border disabled:opacity-30 cursor-pointer"
                    style={{ borderColor: activeTheme.border }}
                  >
                    ← {lang === "tr" ? "Önceki Bölüm" : "Previous"}
                  </button>
                  <span className="opacity-60 font-mono">
                    {chapterIdx + 1} / {ebook?.chapters.length}
                  </span>
                  <button
                    type="button"
                    disabled={!ebook || chapterIdx >= ebook.chapters.length - 1}
                    onClick={() => {
                      setAutoSync(false);
                      setChapterIdx((i) =>
                        Math.min((ebook?.chapters.length ?? 1) - 1, i + 1),
                      );
                      readerScrollRef.current?.scrollTo({ top: 0 });
                    }}
                    className="px-4 py-2 rounded-full st-accent-bg text-white disabled:opacity-30 cursor-pointer"
                  >
                    {lang === "tr" ? "Sonraki Bölüm" : "Next"} →
                  </button>
                </div>
              </article>
            ) : null}
          </div>
          )}
        </section>

        {/* RIGHT PANE: LIVE AUDIOBOOK COMPANION */}
        {showAudioPane && (
        <aside className="lg:col-span-4 st-surface flex flex-col min-h-0 overflow-hidden">
          {/* Audio Player Card */}
          <div className="p-5 border-b st-border space-y-4 shrink-0">
            <div className="flex items-center gap-3.5">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-16 h-16 rounded-xl object-cover st-cover-shadow shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl st-surface-alt flex items-center justify-center shrink-0">
                  <Headphones className="w-6 h-6 st-muted" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-bold st-ink line-clamp-1">
                  {book.title}
                </div>
                <div className="text-xs st-muted truncate">{book.authors}</div>
                {activeAudioChapter && (
                  <div className="text-[11px] text-[#FF5500] font-semibold truncate mt-0.5">
                    {activeAudioChapter.title}
                  </div>
                )}
              </div>
            </div>

            {audioError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
                {audioError}
              </div>
            )}

            {/* Scrubber */}
            <div className="space-y-1.5">
              <div className="relative h-3 flex items-center">
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
              <div className="flex justify-between text-[11px] font-mono st-muted tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
              </div>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => skip(-15)}
                className="p-2 st-ink hover:text-[#FF5500] relative cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="text-[9px] font-bold absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                  15
                </span>
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="w-13 h-13 rounded-full st-accent-bg text-white flex items-center justify-center shadow-lg shadow-[#FF5500]/30 hover:scale-105 transition cursor-pointer"
              >
                {isBuffering ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => skip(15)}
                className="p-2 st-ink hover:text-[#FF5500] relative cursor-pointer"
              >
                <RotateCw className="w-5 h-5" />
                <span className="text-[9px] font-bold absolute -bottom-0.5 left-1/2 -translate-x-1/2">
                  15
                </span>
              </button>
            </div>

            {/* Quick Speed & Sleep Row */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 st-muted mr-0.5" />
                {[1, 1.25, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPlaybackRate(r)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      Math.abs(playbackRate - r) < 0.01
                        ? "st-accent-bg text-white"
                        : "st-bg border st-border st-muted hover:st-ink"
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  sleepTimer.type === "off"
                    ? activeAudioChapter
                      ? setSleepEndOfChapter()
                      : setSleepMinutes(15)
                    : setSleepMinutes(null)
                }
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  sleepTimer.type !== "off"
                    ? "st-accent-soft text-[#FF5500]"
                    : "st-bg border st-border st-muted hover:st-ink"
                }`}
              >
                <Moon className="w-3 h-3" />
                {sleepTimer.type === "off"
                  ? lang === "tr"
                    ? "Uyku"
                    : "Sleep"
                  : sleepTimer.type === "end_of_chapter"
                    ? lang === "tr"
                      ? "Bölüm Sonu"
                      : "Chapter"
                    : formatTime(sleepTimer.remainingSec)}
              </button>
            </div>
          </div>

          {/* Right Pane Tabs: Audio Chapters, Bookmarks & Vocabulary */}
          <div className="px-5 pt-2.5 border-b st-border flex gap-4 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setSideTab("chapters")}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer ${
                sideTab === "chapters"
                  ? "border-[#FF5500] text-[#FF5500]"
                  : "border-transparent st-muted"
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              {lang === "tr" ? "Ses Bölümleri" : "Audio Chapters"} (
              {audioChapters.length})
            </button>
            <button
              type="button"
              onClick={() => setSideTab("bookmarks")}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer ${
                sideTab === "bookmarks"
                  ? "border-[#FF5500] text-[#FF5500]"
                  : "border-transparent st-muted"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              {lang === "tr" ? "Yer İmleri" : "Bookmarks"} ({bookmarks.length})
            </button>
            <button
              type="button"
              onClick={() => setSideTab("vocab")}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                sideTab === "vocab"
                  ? "border-[#FF5500] text-[#FF5500]"
                  : "border-transparent st-muted"
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              {lang === "tr" ? "Kelimeler" : "Words"} ({bookVocabCount})
            </button>
            <button
              type="button"
              onClick={() => setSideTab("highlights")}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                sideTab === "highlights"
                  ? "border-[#FF5500] text-[#FF5500]"
                  : "border-transparent st-muted"
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              {lang === "tr" ? "Alıntılar" : "Notes"} ({highlights.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5 flex flex-col">
            {sideTab === "chapters" &&
              (audioChapters.length === 0 ? (
                <p className="text-xs st-muted text-center py-8">
                  {lang === "tr"
                    ? "Bölüm bilgisi bulunamadı."
                    : "No chapters available."}
                </p>
              ) : (
                audioChapters.map((ch) => {
                  const isAct = activeAudioChapter?.index === ch.index;
                  return (
                    <button
                      key={ch.index}
                      type="button"
                      onClick={() => jumpToChapter(ch)}
                      className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                        isAct
                          ? "st-accent-soft text-[#FF5500] font-bold"
                          : "hover:bg-white/5 st-ink"
                      }`}
                    >
                      <span className="truncate">{ch.title}</span>
                      <span className="text-[11px] font-mono st-muted shrink-0">
                        {formatTime(ch.startMs / 1000)}
                      </span>
                    </button>
                  );
                })
              ))}

            {sideTab === "bookmarks" && (
              <div className="space-y-3">
                <form onSubmit={handleAddBm} className="flex gap-1.5">
                  <input
                    type="text"
                    value={bmNote}
                    onChange={(e) => setBmNote(e.target.value)}
                    placeholder={
                      lang === "tr"
                        ? `Not ekle (${formatTime(currentTime)})...`
                        : `Note (${formatTime(currentTime)})...`
                    }
                    className="flex-1 px-3 py-1.5 rounded-full st-bg border st-border text-xs st-ink focus:outline-none focus:border-[#FF5500]"
                  />
                  <button
                    type="submit"
                    disabled={savingBm}
                    className="px-3 py-1.5 rounded-full st-accent-bg text-white text-xs cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  </button>
                </form>

                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="px-3 py-2 rounded-xl st-bg border st-border flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => seek(bm.positionMs / 1000)}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="text-[11px] font-mono font-bold text-[#FF5500]">
                        {formatTime(bm.positionMs / 1000)}
                      </div>
                      <div className="text-xs st-ink truncate">
                        {bm.note || "Yer imi"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBookmark(bm.id)}
                      className="p-1 st-muted hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {sideTab === "vocab" && (
              <div className="flex-1 -m-4 flex flex-col overflow-hidden">
                <BookVocabPanel
                  bookId={book.id}
                  bookTitle={book.title}
                  isDrawer
                />
              </div>
            )}

            {sideTab === "highlights" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold st-muted uppercase tracking-wider">
                    {highlights.length} {lang === "tr" ? "Alıntı / Not" : "Highlights"}
                  </span>
                  {highlights.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportHighlightsMd}
                      className="px-2.5 py-1 rounded-full st-bg border st-border hover:border-[#FF5500] text-[11px] font-bold text-[#FF5500] flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      Markdown (.md)
                    </button>
                  )}
                </div>
                {highlights.length === 0 ? (
                  <p className="text-xs st-muted text-center py-8">
                    {lang === "tr"
                      ? "E-kitapta bir cümle veya paragraf seçerek vurgulayabilir ve not ekleyebilirsiniz."
                      : "Select any sentence or passage in the e-book to highlight and add margin notes."}
                  </p>
                ) : (
                  highlights.map((h) => {
                    const colorBorder =
                      h.color === "green"
                        ? "border-l-emerald-500"
                        : h.color === "pink"
                          ? "border-l-pink-500"
                          : h.color === "blue"
                            ? "border-l-sky-500"
                            : "border-l-amber-400";
                    return (
                      <div
                        key={h.id}
                        className={`p-3 rounded-xl st-bg border st-border border-l-4 ${colorBorder} space-y-1.5`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setChapterIdx(h.chapterIndex)}
                            className="text-left text-xs st-ink leading-relaxed hover:text-[#FF5500] cursor-pointer"
                          >
                            &ldquo;{h.text}&rdquo;
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHighlight(h.id)}
                            className="p-1 st-muted hover:text-red-500 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {h.note && (
                          <div className="text-[11px] text-[#FF5500] font-medium">
                            📝 {h.note}
                          </div>
                        )}
                        {h.chapterTitle && (
                          <div className="text-[10px] st-muted">{h.chapterTitle}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>
        )}
      </div>

      {/* Floating Vocabulary Quick-Save Popup */}
      {vocabDraft && (
        <div className="fixed bottom-5 left-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] rounded-2xl st-surface border border-[#FF5500]/50 shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#FF5500] flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5" />
              {lang === "tr" ? "Kelime Defterine Kaydet" : "Save to Vocabulary"}
            </span>
            <button
              type="button"
              onClick={() => setVocabDraft(null)}
              className="st-muted hover:st-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveVocabDraft} className="space-y-2.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                value={vocabDraft.word}
                onChange={(e) =>
                  setVocabDraft((p) => (p ? { ...p, word: e.target.value } : p))
                }
                placeholder={lang === "tr" ? "Kelime..." : "Word..."}
                className="flex-1 px-3 py-2 rounded-xl st-bg border st-border text-sm font-bold st-ink focus:outline-none focus:border-[#FF5500]"
              />
              <button
                type="button"
                onClick={() => speakWord(vocabDraft.word, vocabDraft.from)}
                className="p-2 rounded-xl st-surface-alt border st-border text-xs font-bold st-ink hover:text-[#FF5500] hover:border-[#FF5500] cursor-pointer"
                title={lang === "tr" ? "Sesli Dinle" : "Pronounce"}
              >
                <Volume2 className="w-4 h-4 text-[#FF5500]" />
              </button>
              <button
                type="button"
                disabled={vocabDraft.loading || !vocabDraft.word.trim()}
                onClick={() =>
                  openVocabLookup(
                    vocabDraft.word,
                    vocabDraft.context,
                    vocabDraft.to,
                  )
                }
                className="px-3 py-2 rounded-xl st-surface-alt border st-border text-xs font-bold st-ink hover:border-[#FF5500] cursor-pointer"
              >
                {vocabDraft.loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : lang === "tr" ? (
                  "Çevir"
                ) : (
                  "Lookup"
                )}
              </button>
            </div>

            {/* Language pair and phonetic bar */}
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-[10px]">
                  {vocabDraft.from.toUpperCase()} ➔ {vocabDraft.to.toUpperCase()}
                </span>
                {vocabDraft.phonetic && (
                  <span className="font-mono st-muted text-[11px]">
                    {vocabDraft.phonetic}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextTo = vocabDraft.to === "tr" ? "en" : "tr";
                  void openVocabLookup(
                    vocabDraft.word,
                    vocabDraft.context,
                    nextTo,
                  );
                }}
                className="text-[10px] font-bold text-[#FF5500] hover:underline cursor-pointer"
                title={lang === "tr" ? "Çeviri hedefini değiştir" : "Switch target language"}
              >
                ⇄ {vocabDraft.to === "tr" ? "İngilizceye Çevir" : "Türkçeye Çevir"}
              </button>
            </div>

            <textarea
              rows={2}
              value={vocabDraft.meaning}
              onChange={(e) =>
                setVocabDraft((p) => (p ? { ...p, meaning: e.target.value } : p))
              }
              placeholder={
                vocabDraft.loading
                  ? lang === "tr"
                    ? "Çeviri getiriliyor..."
                    : "Looking up..."
                  : lang === "tr"
                    ? "Türkçe anlamı / not..."
                    : "Meaning / note..."
              }
              className="w-full px-3 py-2 rounded-xl st-bg border st-border text-xs st-ink focus:outline-none focus:border-[#FF5500] resize-none"
            />

            <button
              type="submit"
              className={`w-full py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                vocabDraft.saved
                  ? "bg-emerald-600 text-white"
                  : "st-accent-bg text-white"
              }`}
            >
              {vocabDraft.saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {lang === "tr" ? "Kaydedildi!" : "Saved!"}
                </>
              ) : lang === "tr" ? (
                "Deftere Kaydet"
              ) : (
                "Save Word"
              )}
            </button>
          </form>
        </div>
      )}

      {/* Floating Highlight & Margin Note Popup */}
      {highlightDraft && (
        <div className="fixed bottom-5 left-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] rounded-2xl st-surface border border-[#FF5500]/50 shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#FF5500] flex items-center gap-1.5">
              <Highlighter className="w-3.5 h-3.5" />
              {lang === "tr" ? "Vurgula & Not Al" : "Highlight & Note"}
            </span>
            <button
              type="button"
              onClick={() => setHighlightDraft(null)}
              className="st-muted hover:st-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs st-ink italic line-clamp-3 border-l-2 border-[#FF5500] pl-2.5">
            &ldquo;{highlightDraft.text}&rdquo;
          </p>
          <form onSubmit={handleSaveHighlightDraft} className="space-y-2.5">
            <div className="flex items-center gap-2">
              {(
                [
                  { id: "yellow", cls: "bg-amber-400" },
                  { id: "green", cls: "bg-emerald-500" },
                  { id: "pink", cls: "bg-pink-500" },
                  { id: "blue", cls: "bg-sky-500" },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setHighlightDraft({ ...highlightDraft, color: c.id })}
                  className={`w-6 h-6 rounded-full ${c.cls} cursor-pointer transition ${
                    highlightDraft.color === c.id ? "ring-2 ring-white scale-110" : "opacity-65 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
            <input
              type="text"
              value={highlightDraft.note}
              onChange={(e) => setHighlightDraft({ ...highlightDraft, note: e.target.value })}
              placeholder={lang === "tr" ? "Kenar notu ekle (opsiyonel)..." : "Add margin note (optional)..."}
              className="w-full px-3 py-2 rounded-xl st-bg border st-border text-xs st-ink focus:outline-none focus:border-[#FF5500]"
            />
            <button
              type="submit"
              disabled={highlightDraft.saving}
              className="w-full py-2 rounded-xl st-accent-bg text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {highlightDraft.saving
                ? lang === "tr" ? "Kaydediliyor..." : "Saving..."
                : lang === "tr" ? "Alıntıyı Kaydet" : "Save Highlight"}
            </button>
          </form>
        </div>
      )}

      {/* Book-Specific Vocabulary Slide-Over Panel */}
      {showVocabPanel && (
        <BookVocabPanel
          bookId={book.id}
          bookTitle={book.title}
          onClose={() => setShowVocabPanel(false)}
        />
      )}
    </div>
  );
}
