"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  Check,
  Download,
  Loader2,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import type { VocabEntry } from "@/lib/storytel/types";
import { usePreferences } from "./PreferencesContext";

export default function VocabularyView() {
  const { lang } = usePreferences();
  const [words, setWords] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newPhonetic, setNewPhonetic] = useState("");
  const [newContext, setNewContext] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter & Flashcard mode
  const [filter, setFilter] = useState<"all" | "learning" | "mastered">("all");
  const [query, setQuery] = useState("");
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/vocabulary", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setWords(Array.isArray(data.words) ? data.words : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  };

  const handleLookup = async () => {
    const w = newWord.trim();
    if (!w) return;
    setLookingUp(true);
    try {
      const res = await fetch(
        `/api/vocabulary/lookup?word=${encodeURIComponent(w)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.meaning) setNewMeaning(data.meaning);
        if (data.phonetic) setNewPhonetic(data.phonetic);
      }
    } finally {
      setLookingUp(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: newWord.trim(),
          meaning: newMeaning.trim(),
          phonetic: newPhonetic.trim() || undefined,
          context: newContext.trim() || undefined,
        }),
      });
      if (res.ok) {
        setNewWord("");
        setNewMeaning("");
        setNewPhonetic("");
        setNewContext("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMastered = async (item: VocabEntry) => {
    const res = await fetch(`/api/vocabulary/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mastered: !item.mastered }),
    });
    if (res.ok) {
      setWords((prev) =>
        prev.map((w) =>
          w.id === item.id ? { ...w, mastered: !w.mastered } : w,
        ),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/vocabulary/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setWords((prev) => prev.filter((w) => w.id !== id));
    }
  };

  const handleExportCsv = () => {
    const esc = (s = "") => `"${s.replace(/"/g, '""')}"`;
    const rows = [
      ["Word", "Meaning", "Phonetic", "Context", "Book", "Mastered"].join(","),
      ...words.map((w) =>
        [
          esc(w.word),
          esc(w.meaning),
          esc(w.phonetic || ""),
          esc(w.context || ""),
          esc(w.bookTitle || ""),
          w.mastered ? "Yes" : "No",
        ].join(","),
      ),
    ];
    // UTF-8 BOM so Excel / Anki display Turkish characters cleanly
    const blob = new Blob(["\uFEFF" + rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storytel-vocabulary.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    return words.filter((w) => {
      if (filter === "learning" && w.mastered) return false;
      if (filter === "mastered" && !w.mastered) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          w.word.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q) ||
          (w.bookTitle || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [words, filter, query]);

  const studyDeck = useMemo(
    () => words.filter((w) => !w.mastered),
    [words],
  );
  const activeCard = studyDeck[cardIdx % Math.max(1, studyDeck.length)] ?? null;

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-7 h-7 text-[#FF5500] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Add Word Card */}
      <form
        onSubmit={handleAdd}
        className="p-5 rounded-3xl st-surface border st-border space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold st-ink flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-[#FF5500]" />
            {lang === "tr" ? "Yeni Kelime Ekle" : "Add New Word"}
          </div>
          <div className="flex items-center gap-2">
            {studyDeck.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFlashcardMode((v) => !v);
                  setCardIdx(0);
                  setFlipped(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  flashcardMode
                    ? "st-accent-bg text-white"
                    : "st-accent-soft text-[#FF5500]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {flashcardMode
                  ? lang === "tr"
                    ? "Listeye Dön"
                    : "Back to List"
                  : lang === "tr"
                    ? `Kartla Çalış (${studyDeck.length})`
                    : `Flashcards (${studyDeck.length})`}
              </button>
            )}
            {words.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3.5 py-1.5 rounded-full st-bg border st-border hover:border-[#FF5500] text-xs font-semibold st-ink flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                CSV / Anki
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-4 flex gap-1.5">
            <input
              type="text"
              required
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder={lang === "tr" ? "İngilizce kelime..." : "Word..."}
              className="flex-1 px-3.5 py-2.5 rounded-xl st-bg border st-border text-sm st-ink focus:outline-none focus:border-[#FF5500]"
            />
            <button
              type="button"
              disabled={lookingUp || !newWord.trim()}
              onClick={handleLookup}
              className="px-3 py-2.5 rounded-xl st-surface-alt border st-border hover:border-[#FF5500] text-xs font-bold st-ink disabled:opacity-40 cursor-pointer shrink-0"
              title={
                lang === "tr"
                  ? "Türkçe anlamını ve telaffuzunu otomatik getir"
                  : "Auto-translate & define"
              }
            >
              {lookingUp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : lang === "tr" ? (
                "Çevir"
              ) : (
                "Lookup"
              )}
            </button>
          </div>

          <input
            type="text"
            value={newMeaning}
            onChange={(e) => setNewMeaning(e.target.value)}
            placeholder={
              lang === "tr"
                ? "Türkçe anlamı / tanımı..."
                : "Translation / definition..."
            }
            className="md:col-span-4 px-3.5 py-2.5 rounded-xl st-bg border st-border text-sm st-ink focus:outline-none focus:border-[#FF5500]"
          />

          <input
            type="text"
            value={newContext}
            onChange={(e) => setNewContext(e.target.value)}
            placeholder={
              lang === "tr"
                ? "Örnek cümle (isteğe bağlı)..."
                : "Example sentence (optional)..."
            }
            className="md:col-span-3 px-3.5 py-2.5 rounded-xl st-bg border st-border text-sm st-ink focus:outline-none focus:border-[#FF5500]"
          />

          <button
            type="submit"
            disabled={saving}
            className="md:col-span-1 py-2.5 px-3 rounded-xl st-accent-bg text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {lang === "tr" ? "Ekle" : "Add"}
          </button>
        </div>
      </form>

      {/* Flashcard Practice Mode */}
      {flashcardMode && activeCard ? (
        <div className="max-w-lg mx-auto py-4 space-y-4">
          <div
            onClick={() => setFlipped((f) => !f)}
            className="min-h-[260px] rounded-3xl st-surface border-2 border-[#FF5500]/40 p-8 flex flex-col items-center justify-center text-center cursor-pointer shadow-xl transition hover:border-[#FF5500]"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5500] mb-3">
              {flipped
                ? lang === "tr"
                  ? "Anlamı"
                  : "Meaning"
                : lang === "tr"
                  ? "Cevabı görmek için tıkla"
                  : "Click to flip"}
            </span>

            {!flipped ? (
              <>
                <div className="font-serif-st text-3xl font-bold st-ink">
                  {activeCard.word}
                </div>
                {activeCard.phonetic && (
                  <div className="text-sm st-muted mt-1">
                    {activeCard.phonetic}
                  </div>
                )}
                {activeCard.context && (
                  <p className="text-xs st-muted italic mt-4 max-w-md">
                    &ldquo;{activeCard.context}&rdquo;
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-xl font-bold st-ink leading-relaxed">
                  {activeCard.meaning || "—"}
                </div>
                {activeCard.bookTitle && (
                  <div className="text-xs st-muted mt-3">
                    {activeCard.bookTitle}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => speak(activeCard.word)}
              className="px-4 py-2.5 rounded-full st-surface border st-border text-xs font-bold st-ink flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-[#FF5500]" />
              {lang === "tr" ? "Dinle" : "Pronounce"}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await handleToggleMastered(activeCard);
                  setFlipped(false);
                }}
                className="px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {lang === "tr" ? "Öğrendim" : "Mastered"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCardIdx((i) => (i + 1) % studyDeck.length);
                  setFlipped(false);
                }}
                className="px-4 py-2.5 rounded-full st-accent-bg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                {lang === "tr" ? "Sonraki" : "Next"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(
                [
                  { id: "all", label: lang === "tr" ? "Tümü" : "All", count: words.length },
                  {
                    id: "learning",
                    label: lang === "tr" ? "Öğreniliyor" : "Learning",
                    count: words.filter((w) => !w.mastered).length,
                  },
                  {
                    id: "mastered",
                    label: lang === "tr" ? "Öğrendim" : "Mastered",
                    count: words.filter((w) => w.mastered).length,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    filter === tab.id
                      ? "st-accent-bg text-white"
                      : "st-surface border st-border st-muted hover:st-ink"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 st-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  lang === "tr" ? "Kelimelerde ara..." : "Search words..."
                }
                className="pl-9 pr-3.5 py-2 w-56 rounded-full st-surface border st-border text-xs st-ink focus:outline-none focus:border-[#FF5500]"
              />
            </div>
          </div>

          {/* Word Cards */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <BookMarked className="w-10 h-10 st-muted opacity-40 mx-auto" />
              <p className="text-sm font-semibold st-ink">
                {lang === "tr"
                  ? "Kelime defterin henüz boş"
                  : "Your vocabulary notebook is empty"}
              </p>
              <p className="text-xs st-muted max-w-md mx-auto">
                {lang === "tr"
                  ? "E-kitap okurken herhangi bir kelimeyi seçip tek tıkla kaydedebilir veya yukarıdan manuel ekleyebilirsin."
                  : "Highlight any word while reading an e-book to translate & save it in one click, or add words above."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl st-surface border flex flex-col gap-2 transition ${
                    item.mastered
                      ? "border-emerald-500/30 opacity-80"
                      : "st-border hover:border-[#FF5500]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold st-ink">
                          {item.word}
                        </span>
                        {item.phonetic && (
                          <span className="text-xs st-muted font-mono">
                            {item.phonetic}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => speak(item.word)}
                          className="p-1 rounded-full st-bg border st-border st-muted hover:text-[#FF5500] cursor-pointer"
                          title={lang === "tr" ? "Telaffuzu dinle" : "Listen"}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {item.meaning && (
                        <p className="text-sm st-ink/90 mt-1">{item.meaning}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleMastered(item)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                          item.mastered
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "st-bg border st-border st-muted hover:text-emerald-500"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        {item.mastered
                          ? lang === "tr"
                            ? "Öğrendim"
                            : "Mastered"
                          : lang === "tr"
                            ? "Öğren"
                            : "Mark"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 st-muted hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.context && (
                    <p className="text-xs st-muted italic border-l-2 border-[#FF5500]/50 pl-2.5">
                      &ldquo;{item.context}&rdquo;
                    </p>
                  )}

                  {item.bookTitle && (
                    <div className="text-[11px] st-muted pt-1">
                      📖 {item.bookTitle}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
