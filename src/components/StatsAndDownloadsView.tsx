"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Clock,
  Download,
  HardDrive,
  Loader2,
  Play,
  Trash2,
} from "lucide-react";
import type {
  ActiveDownload,
  BookshelfBook,
  DownloadEntry,
  ListeningStats,
} from "@/lib/storytel/types";
import { formatBytes, formatDurationMs } from "@/lib/format";
import { toPlayingBook, usePlayer } from "./PlayerContext";

export function DownloadsView({
  books,
  onChanged,
}: {
  books: BookshelfBook[];
  onChanged: () => void;
}) {
  const { playBook } = usePlayer();
  const [files, setFiles] = useState<DownloadEntry[]>([]);
  const [active, setActive] = useState<ActiveDownload[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/downloads");
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setActive(data.active || []);
        setTotalBytes(data.totalBytes || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 2500);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (bookId: string) => {
    await fetch(`/api/downloads/${encodeURIComponent(bookId)}`, {
      method: "DELETE",
    });
    await load();
    onChanged();
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-[#FF5500] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-3xl st-surface border st-border shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl st-accent-soft text-[#FF5500] flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold st-ink">Çevrimdışı Depolama</div>
            <div className="text-xs st-muted">
              {files.length} kitap indirildi · Toplam {formatBytes(totalBytes)}
            </div>
          </div>
        </div>
      </div>

      {active.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider st-muted">
            Devam Eden İndirmeler
          </h3>
          {active.map((dl) => (
            <div
              key={dl.bookId}
              className="p-4 rounded-2xl st-surface border border-[#FF5500]/40 space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold st-ink truncate">{dl.title}</span>
                <span className="text-xs text-[#FF5500] font-mono font-bold">
                  %{dl.percentage}
                </span>
              </div>
              <div className="h-1.5 st-surface-alt rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF5500] transition-all"
                  style={{ width: `${dl.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs st-muted">
                <span>
                  {formatBytes(dl.downloadedBytes)} /{" "}
                  {dl.totalBytes > 0 ? formatBytes(dl.totalBytes) : "..."}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(dl.bookId)}
                  className="text-red-500 font-semibold hover:underline cursor-pointer"
                >
                  İptal Et
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Download className="w-10 h-10 st-muted opacity-40 mx-auto" />
          <p className="text-sm font-semibold st-ink">
            Henüz indirilmiş sesli kitap yok
          </p>
          <p className="text-xs st-muted">
            Bir kitabın detayına tıklayıp &quot;İndir&quot; butonunu kullanabilirsin.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {files.map((f) => {
            const matched = books.find((b) => b.id === f.bookId);
            return (
              <div
                key={f.bookId}
                className="p-4 rounded-2xl st-surface border st-border flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {matched?.coverUrl ? (
                    <img
                      src={matched.coverUrl}
                      alt={f.title}
                      className="w-14 h-14 rounded-xl object-cover st-cover-shadow shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl st-surface-alt shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-bold st-ink truncate">
                      {matched?.title || f.title}
                    </div>
                    <div className="text-xs st-muted">
                      {formatBytes(f.bytes)} · Çevrimdışı Hazır
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      playBook(
                        matched
                          ? toPlayingBook(matched)
                          : {
                              id: f.bookId,
                              title: f.title,
                              authors: "",
                              coverUrl: "",
                              durationMs: 0,
                            },
                      )
                    }
                    className="px-4 py-2 rounded-full st-accent-bg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Dinle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(f.bookId)}
                    className="p-2 rounded-full st-bg border st-border st-muted hover:text-red-500 transition cursor-pointer"
                    title="Dosyayı sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StatsView({
  onOpenDetail,
}: {
  onOpenDetail: (bookId: string) => void;
}) {
  const [stats, setStats] = useState<ListeningStats | null>(null);

  useEffect(() => {
    const loadStats = () => {
      fetch("/api/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setStats(data);
        })
        .catch(() => {});
    };
    loadStats();
    window.addEventListener("profile-switched", loadStats);
    return () => window.removeEventListener("profile-switched", loadStats);
  }, []);

  if (!stats) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-[#FF5500] animate-spin" />
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("tr-TR", { weekday: "short" });
    const mins = Math.round((stats.dailySeconds[key] || 0) / 60);
    return { key, label, mins };
  });
  const maxMin = Math.max(10, ...days.map((d) => d.mins));

  const totalHours = (stats.totalSeconds / 3600).toFixed(1);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMins = Math.round((stats.dailySeconds[todayKey] || 0) / 60);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl st-surface border st-border shadow-sm">
          <div className="text-xs font-semibold st-muted flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#FF5500]" />
            Toplam Dinleme
          </div>
          <div className="font-serif-st text-3xl font-bold st-ink mt-2">
            {totalHours} sa
          </div>
        </div>
        <div className="p-5 rounded-3xl st-surface border st-border shadow-sm">
          <div className="text-xs font-semibold st-muted flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            Bugün
          </div>
          <div className="font-serif-st text-3xl font-bold st-ink mt-2">
            {todayMins} dk
          </div>
        </div>
        <div className="p-5 rounded-3xl st-surface border st-border shadow-sm">
          <div className="text-xs font-semibold st-muted">Son Dinlenenler</div>
          <div className="font-serif-st text-3xl font-bold st-ink mt-2">
            {stats.recentBooks.length}
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl st-surface border st-border shadow-sm">
        <h3 className="font-serif-st text-base font-bold st-ink mb-5">
          Son 7 Gün Dinleme Süresi (dk)
        </h3>
        <div className="grid grid-cols-7 gap-3 items-end h-40">
          {days.map((d) => (
            <div
              key={d.key}
              className="flex flex-col items-center gap-2 h-full justify-end"
            >
              <span className="text-[11px] st-muted font-mono">
                {d.mins > 0 ? d.mins : ""}
              </span>
              <div
                className="w-full max-w-[36px] rounded-t-xl bg-[#FF5500] transition-all"
                style={{
                  height: `${Math.max(5, Math.round((d.mins / maxMin) * 100))}%`,
                }}
              />
              <span className="text-xs font-semibold st-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.recentBooks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif-st text-base font-bold st-ink">
            Son Dinlediklerin
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.recentBooks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onOpenDetail(b.id)}
                className="p-3.5 rounded-2xl st-surface border st-border hover:border-[#FF5500]/50 flex items-center gap-3.5 text-left transition cursor-pointer shadow-sm"
              >
                {b.coverUrl ? (
                  <img
                    src={b.coverUrl}
                    alt={b.title}
                    className="w-14 h-14 rounded-xl object-cover st-cover-shadow shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl st-surface-alt shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold st-ink truncate">
                    {b.title}
                  </div>
                  <div className="text-xs st-muted truncate">{b.authors}</div>
                  {b.durationMs > 0 && (
                    <div className="text-[11px] text-[#FF5500] font-semibold mt-1">
                      {formatDurationMs(b.positionMs)} /{" "}
                      {formatDurationMs(b.durationMs)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
