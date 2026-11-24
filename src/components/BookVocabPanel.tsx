"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BookMarked,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type { VocabEntry } from "@/lib/storytel/types";
import { usePreferences } from "./PreferencesContext";

interface BookVocabPanelProps {
  bookId: string;
  bookTitle?: string;
  onClose?: () => void;
  isDrawer?: boolean; // If true, styles as a bottom sheet / drawer; otherwise right side-panel
}

export default function BookVocabPanel({
  bookId,
  bookTitle,
  onClose,
  isDrawer = false,
}: BookVocabPanelProps) {
  const { lang } = usePreferences();
  const [words, setWords] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "learning" | "mastered">("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newContext, setNewContext] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchBookWords = useCallback(async () => {
    try {
      const res = await fetch(`/api/vocabulary?bookId=${encodeURIComponent(bookId)}`);
      if (res.ok) {
        const data = await res.json();
        setWords(data.words || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const notifyChange = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vocab-updated", { detail: { bookId } }),
      );
    }
  }, [bookId]);

  useEffect(() => {
    fetchBookWords();
    const handleRemoteUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ bookId?: string }>;
      if (!ce.detail?.bookId || ce.detail.bookId === bookId) {
        fetchBookWords();
      }
    };
    window.addEventListener("vocab-updated", handleRemoteUpdate);
    return () => window.removeEventListener("vocab-updated", handleRemoteUpdate);
  }, [fetchBookWords, bookId]);

  const speakWord = (word: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(word);
    utt.lang = "en-US";
    window.speechSynthesis.speak(utt);
  };

  const handleToggleMastered = async (entry: VocabEntry) => {
    const nextVal = !entry.mastered;
    setWords((prev) =>
      prev.map((w) => (w.id === entry.id ? { ...w, mastered: nextVal } : w)),
    );

    await fetch(`/api/vocabulary/${encodeURIComponent(entry.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mastered: nextVal }),
    }).catch(() => {});
  };

  const handleDelete = async (id: string) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
    notifyChange();
    await fetch(`/api/vocabulary/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => {});
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: newWord.trim(),
          meaning: newMeaning.trim(),
          context: newContext.trim() || undefined,
          bookId,
          bookTitle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.entry) {
          setWords((prev) => [data.entry, ...prev.filter((w) => w.id !== data.entry.id)]);
        }
        setNewWord("");
        setNewMeaning("");
        setNewContext("");
        setShowAddForm(false);
        notifyChange();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredWords = words.filter((w) => {
    if (filter === "learning" && w.mastered) return false;
    if (filter === "mastered" && !w.mastered) return false;
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      return (
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.context && w.context.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b st-border flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-[#FF5500] shrink-0" />
            <h3 className="text-sm font-bold st-ink truncate">
              {lang === "tr" ? "Kitabın Kelimeleri" : "Book Vocabulary"}
            </h3>
            <span className="px-2 py-0.5 rounded-full st-accent-soft text-[#FF5500] text-[10px] font-extrabold shrink-0">
              {words.length}
            </span>
          </div>
          {bookTitle && (
            <p className="text-[11px] st-muted truncate mt-0.5">{bookTitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="p-1.5 rounded-lg st-bg border st-border text-[#FF5500] hover:border-[#FF5500] transition cursor-pointer"
            title={lang === "tr" ? "Kelime Ekle" : "Add Word"}
          >
            <Plus className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg st-muted hover:st-ink transition cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="p-4 border-b st-border st-surface-alt space-y-2.5 animate-in slide-in-from-top-2 duration-150 shrink-0"
        >
          <div className="text-xs font-bold st-ink flex items-center justify-between">
            <span>{lang === "tr" ? "Yeni Kelime Ekle" : "Add Word"}</span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[11px] st-muted hover:st-ink cursor-pointer"
            >
              {lang === "tr" ? "Vazgeç" : "Cancel"}
            </button>
          </div>
          <input
            type="text"
            placeholder={lang === "tr" ? "Kelime / İfade *" : "Word / Phrase *"}
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-1.5 rounded-xl st-bg border st-border text-xs st-ink placeholder:st-muted focus:outline-none focus:border-[#FF5500]"
          />
          <input
            type="text"
            placeholder={lang === "tr" ? "Anlamı / Çevirisi" : "Meaning / Translation"}
            value={newMeaning}
            onChange={(e) => setNewMeaning(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl st-bg border st-border text-xs st-ink placeholder:st-muted focus:outline-none focus:border-[#FF5500]"
          />
          <input
            type="text"
            placeholder={lang === "tr" ? "Cümle içi kullanımı (opsiyonel)" : "Context sentence (optional)"}
            value={newContext}
            onChange={(e) => setNewContext(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl st-bg border st-border text-xs st-ink placeholder:st-muted focus:outline-none focus:border-[#FF5500]"
          />
          <button
            type="submit"
            disabled={submitting || !newWord.trim()}
            className="w-full py-2 rounded-xl st-accent-bg text-white text-xs font-bold shadow hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Kaydediliyor..." : lang === "tr" ? "Deftere Kaydet" : "Save to Notebook"}
          </button>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="p-3 border-b st-border space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 st-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={lang === "tr" ? "Bu kitaptaki kelimeleri ara..." : "Search words in this book..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl st-bg border st-border text-xs st-ink placeholder:st-muted focus:outline-none focus:border-[#FF5500]"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "learning", "mastered"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                filter === f
                  ? "st-accent-soft text-[#FF5500]"
                  : "st-muted hover:st-ink"
              }`}
            >
              {f === "all"
                ? lang === "tr"
                  ? "Tümü"
                  : "All"
                : f === "learning"
                ? lang === "tr"
                  ? "Öğrenilecek"
                  : "Learning"
                : lang === "tr"
                ? "Öğrenildi"
                : "Mastered"}
            </button>
          ))}
        </div>
      </div>

      {/* Words List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 st-muted text-xs">
            <Loader2 className="w-5 h-5 text-[#FF5500] animate-spin" />
            <span>Yükleniyor...</span>
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="py-12 text-center st-muted space-y-2">
            <BookMarked className="w-8 h-8 mx-auto opacity-35" />
            <p className="text-xs">
              {query
                ? "Aramanızla eşleşen kelime bulunamadı."
                : lang === "tr"
                ? "Bu kitaptan henüz kaydedilmiş kelime yok."
                : "No saved words from this book yet."}
            </p>
            <p className="text-[11px] text-muted max-w-xs mx-auto">
              {lang === "tr"
                ? "Okurken metinde bilmediğin bir kelimeye çift tıklayarak anında defterine ekleyebilirsin."
                : "Double-click any word while reading to look up definitions and save."}
            </p>
          </div>
        ) : (
          filteredWords.map((entry) => (
            <div
              key={entry.id}
              className={`p-3 rounded-2xl border transition group ${
                entry.mastered
                  ? "st-surface/60 border-emerald-500/20"
                  : "st-surface border st-border hover:border-[#FF5500]/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm st-ink">{entry.word}</span>
                    {entry.phonetic && (
                      <span className="text-[11px] font-mono st-muted">
                        /{entry.phonetic}/
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => speakWord(entry.word)}
                      className="p-1 rounded-full text-[#FF5500] hover:bg-white/10 transition cursor-pointer"
                      title="Dinle / Seslendir"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {entry.meaning && (
                    <p className="text-xs font-semibold text-emerald-400 mt-1">
                      {entry.meaning}
                    </p>
                  )}

                  {entry.context && (
                    <blockquote className="text-[11px] st-muted italic mt-1.5 pl-2 border-l-2 border-[#FF5500]/40 line-clamp-2">
                      &ldquo;{entry.context}&rdquo;
                    </blockquote>
                  )}
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleMastered(entry)}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      entry.mastered
                        ? "text-emerald-500 bg-emerald-500/15"
                        : "st-muted hover:text-emerald-500 hover:bg-emerald-500/10"
                    }`}
                    title={entry.mastered ? "Öğrenildi olarak işaretli" : "Öğrenildi olarak işaretle"}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="p-1.5 rounded-lg st-muted hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer link to main vocabulary */}
      <div className="p-3 border-t st-border bg-white/[0.015] flex items-center justify-between text-xs st-muted shrink-0">
        <span>Tüm kelimeler ana sayfada</span>
        <a
          href="#vocabulary"
          onClick={onClose}
          className="text-[#FF5500] font-bold hover:underline inline-flex items-center gap-1"
        >
          <span>Kelime Defteri</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );

  if (isDrawer) {
    return (
      <div className="z-50 w-88 max-w-[calc(100vw-2rem)] rounded-3xl st-surface border st-border shadow-2xl h-[520px] max-h-[70vh] flex flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  // Right Side Panel Slide-Over
  return (
    <div className="fixed right-0 top-14 bottom-0 z-40 w-80 sm:w-96 st-surface border-l st-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {content}
    </div>
  );
}
