"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  Clock,
  Download,
  Flame,
  HardDrive,
  Loader2,
  Music,
  Play,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  ActiveDownload,
  BookshelfBook,
  DownloadEntry,
  ListeningStats,
  LocalAudiobook,
} from "@/lib/storytel/types";
import type { StreakAndBadges } from "@/lib/srs";
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
  const [localBooks, setLocalBooks] = useState<LocalAudiobook[]>([]);
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [dlRes, locRes] = await Promise.all([
        fetch("/api/downloads"),
        fetch("/api/local-books"),
      ]);
      if (dlRes.ok) {
        const data = await dlRes.json();
        setFiles(data.files || []);
        setActive(data.active || []);
        setTotalBytes(data.totalBytes || 0);
      }
      if (locRes.ok) {
        const lData = await locRes.json();
        setLocalBooks(lData.books || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLocal(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/local-books", { method: "POST", body: fd });
      if (res.ok) await load();
    } finally {
      setUploadingLocal(false);
      e.target.value = "";
    }
  };

  const handleDeleteLocal = async (id: string) => {
    await fetch(`/api/local-books?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
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

      {/* Local DRM-Free Audiobooks (.mp3 / .m4b / .m4a) */}
      <div className="pt-4 border-t st-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold st-ink flex items-center gap-2">
              <Music className="w-4 h-4 text-[#FF5500]" />
              Yerel Sesli Kitapların (.mp3 / .m4b / .m4a)
            </h3>
            <p className="text-xs st-muted mt-0.5">
              Bilgisayarındaki kendi sesli kitaplarını içe aktarıp aynı oynatıcıda dinle.
            </p>
          </div>
          <input
            ref={localInputRef}
            type="file"
            accept=".mp3,.m4b,.m4a,audio/*"
            onChange={handleLocalUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploadingLocal}
            onClick={() => localInputRef.current?.click()}
            className="px-4 py-2 rounded-full st-accent-bg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {uploadingLocal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Ses Dosyası Ekle
          </button>
        </div>

        {localBooks.length > 0 && (
          <div className="space-y-2.5">
            {localBooks.map((lb) => (
              <div
                key={lb.id}
                className="p-3.5 rounded-2xl st-surface border st-border flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm st-ink truncate">{lb.title}</div>
                  <div className="text-xs st-muted mt-0.5">
                    {lb.format.toUpperCase()} • {formatBytes(lb.bytes)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      playBook({
                        id: lb.id,
                        title: lb.title,
                        authors: lb.authors,
                        coverUrl: "",
                        durationMs: 0,
                      })
                    }
                    className="px-4 py-2 rounded-full st-accent-bg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Dinle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLocal(lb.id)}
                    className="p-2 rounded-full st-bg border st-border st-muted hover:text-red-500 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type StatsPayload = ListeningStats & { streaksAndBadges?: StreakAndBadges };

export function StatsView({
  onOpenDetail,
}: {
  onOpenDetail: (bookId: string) => void;
}) {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [goalInput, setGoalInput] = useState("20");
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const loadStats = () => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StatsPayload | null) => {
        if (data) {
          setStats(data);
          if (data.dailyGoalMinutes) setGoalInput(String(data.dailyGoalMinutes));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadStats();
    window.addEventListener("profile-switched", loadStats);
    return () => window.removeEventListener("profile-switched", loadStats);
  }, []);

  const handleSaveGoal = async () => {
    const mins = Math.max(5, Math.min(600, Number(goalInput) || 20));
    const res = await fetch("/api/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyGoalMinutes: mins }),
    });
    if (res.ok) setStats(await res.json());
  };

  const handleExportBackup = async () => {
    const res = await fetch("/api/backup");
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storytel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (res.ok) {
        setBackupMsg("Yedek başarıyla geri yüklendi! Sayfa yenileniyor...");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setBackupMsg("Geçersiz yedek dosyası.");
      }
    } catch {
      setBackupMsg("Yedek dosyası okunamadı.");
    } finally {
      e.target.value = "";
    }
  };

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
  const sb = stats.streaksAndBadges;
  const dailyGoal = sb?.dailyGoalMinutes ?? stats.dailyGoalMinutes ?? 20;
  const goalPct = Math.min(100, Math.round((todayMins / Math.max(1, dailyGoal)) * 100));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
          <div className="text-xs font-semibold st-muted flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            Dinleme Serisi
          </div>
          <div className="font-serif-st text-3xl font-bold st-ink mt-2">
            {sb?.currentStreakDays ?? 0} gün
          </div>
          <div className="text-[11px] st-muted mt-1">
            En uzun: {sb?.longestStreakDays ?? 0} gün
          </div>
        </div>
        <div className="p-5 rounded-3xl st-surface border st-border shadow-sm">
          <div className="text-xs font-semibold st-muted">Son Dinlenenler</div>
          <div className="font-serif-st text-3xl font-bold st-ink mt-2">
            {stats.recentBooks.length}
          </div>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <div className="p-5 rounded-3xl st-surface border st-border shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold st-ink">
            <Target className="w-4 h-4 text-[#FF5500]" />
            <span>Günlük Dinleme Hedefi ({todayMins} / {dailyGoal} dk · %{goalPct})</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={600}
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="w-20 px-2.5 py-1 rounded-xl st-bg border st-border text-xs st-ink"
            />
            <button
              type="button"
              onClick={handleSaveGoal}
              className="px-3 py-1 rounded-xl st-accent-bg text-white text-xs font-bold cursor-pointer"
            >
              Kaydet
            </button>
          </div>
        </div>
        <div className="h-2.5 rounded-full st-bg overflow-hidden">
          <div
            className="h-full bg-[#FF5500] transition-all"
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </div>

      {/* Achievement Badges */}
      {sb && sb.badges.length > 0 && (
        <div className="p-5 rounded-3xl st-surface border st-border shadow-sm space-y-3">
          <h3 className="font-serif-st text-base font-bold st-ink flex items-center gap-2">
            <Award className="w-4 h-4 text-[#FF5500]" />
            Başarım Rozetleri
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {sb.badges.map((b) => (
              <div
                key={b.id}
                className={`p-3 rounded-2xl border text-center transition ${
                  b.unlocked
                    ? "st-accent-soft border-[#FF5500]/40 st-ink"
                    : "st-bg st-border opacity-45 grayscale"
                }`}
              >
                <div className="text-2xl">{b.icon}</div>
                <div className="text-[11px] font-bold mt-1.5">{b.titleTr}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Full Backup Export / Import */}
      <div className="p-5 rounded-3xl st-surface border st-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold st-ink">Tam Yedekleme & Taşıma (JSON)</div>
          <div className="text-xs st-muted mt-0.5">
            Tüm profilleri, kelime defterlerini, vurguları, koleksiyonları ve istatistikleri dışa aktar veya geri yükle.
          </div>
          {backupMsg && <div className="text-xs text-[#FF5500] font-semibold mt-1">{backupMsg}</div>}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackup}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2 rounded-full st-bg border st-border hover:border-[#FF5500] text-xs font-bold st-ink flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#FF5500]" />
            Yedek İndir
          </button>
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="px-4 py-2 rounded-full st-accent-bg text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Yedek Yükle
          </button>
        </div>
      </div>
    </div>
  );
}
