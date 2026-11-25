"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BookBookmark,
  BookChapter,
  BookshelfBook,
} from "@/lib/storytel/types";

export interface PlayingBook {
  id: string;
  abookId?: string | null;
  title: string;
  authors: string;
  narrators?: string;
  coverUrl: string;
  durationMs: number;
  positionMs?: number;
}

export type SleepTimerMode =
  | { type: "off" }
  | { type: "countdown"; endsAt: number; remainingSec: number }
  | { type: "end_of_chapter"; chapterIndex: number };

interface PlayerContextValue {
  currentBook: PlayingBook | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number; // seconds
  duration: number; // seconds
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  chapters: BookChapter[];
  activeChapter: BookChapter | null;
  bookmarks: BookBookmark[];
  sleepTimer: SleepTimerMode;
  error: string | null;
  playBook: (book: PlayingBook, startSeconds?: number) => Promise<void>;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setSleepMinutes: (minutes: number | null) => void;
  setSleepEndOfChapter: () => void;
  jumpToChapter: (chapter: BookChapter) => void;
  addQuickBookmark: (note: string) => Promise<boolean>;
  deleteBookmark: (bookmarkId: string) => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  syncPositionNow: () => Promise<void>;
  stopPlayer: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const RATE_STORAGE_KEY = "st_studio_playback_rate";
const VOL_STORAGE_KEY = "st_studio_volume";
const LAST_PLAYED_STORAGE_KEY = "st_studio_last_played";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentBook, setCurrentBook] = useState<PlayingBook | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [bookmarks, setBookmarks] = useState<BookBookmark[]>([]);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerMode>({ type: "off" });
  const [error, setError] = useState<string | null>(null);

  const pendingSeekRef = useRef<number | null>(null);
  const lastSyncRef = useRef<number>(0);
  const currentBookRef = useRef<PlayingBook | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const listeningAccRef = useRef<number>(0);

  currentBookRef.current = currentBook;
  isPlayingRef.current = isPlaying;

  // Restore saved playback rate & volume
  useEffect(() => {
    try {
      const savedRate = parseFloat(localStorage.getItem(RATE_STORAGE_KEY) || "1");
      if (savedRate >= 0.5 && savedRate <= 3) setPlaybackRateState(savedRate);
      const savedVol = parseFloat(localStorage.getItem(VOL_STORAGE_KEY) || "1");
      if (savedVol >= 0 && savedVol <= 1) setVolumeState(savedVol);
    } catch {
      // ignore
    }
  }, []);

  // Save active book & playback position to localStorage for persistence across reloads
  useEffect(() => {
    if (!currentBook) return;
    try {
      localStorage.setItem(
        LAST_PLAYED_STORAGE_KEY,
        JSON.stringify({
          book: currentBook,
          positionSec: currentTime,
          duration,
          updatedAt: Date.now(),
        }),
      );
    } catch {}
  }, [currentBook, currentTime, duration]);

  // Restore last played book on app mount so refreshing the page preserves playback state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_PLAYED_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data?.book?.id) return;

      const book: PlayingBook = data.book;
      const initialSec = Math.max(0, Number(data.positionSec) || 0);

      setCurrentBook(book);
      if (book.durationMs > 0) {
        setDuration(book.durationMs / 1000);
      }
      setCurrentTime(initialSec);
      pendingSeekRef.current = initialSec;

      const audio = audioRef.current;
      if (audio) {
        const query = book.abookId
          ? `?abookId=${encodeURIComponent(book.abookId)}`
          : "";
        audio.src = `/api/stream/${encodeURIComponent(book.id)}${query}`;
      }

      // Pre-fetch chapters & bookmarks so chapters list is ready
      fetch(`/api/books/${encodeURIComponent(book.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((detail) => {
          if (!detail) return;
          if (Array.isArray(detail.chapters)) setChapters(detail.chapters);
          if (Array.isArray(detail.bookmarks)) setBookmarks(detail.bookmarks);
          if (detail.durationMs > 0) setDuration(detail.durationMs / 1000);
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  // Create single HTMLAudioElement
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onPlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => {
      setIsBuffering(false);
      if (pendingSeekRef.current !== null) {
        const target = pendingSeekRef.current;
        pendingSeekRef.current = null;
        if (Number.isFinite(target) && target >= 0) {
          audio.currentTime = target;
          setCurrentTime(target);
        }
      }
    };
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      if (pendingSeekRef.current !== null) {
        const target = pendingSeekRef.current;
        pendingSeekRef.current = null;
        if (Number.isFinite(target) && target >= 0) {
          audio.currentTime = target;
          setCurrentTime(target);
        }
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setError("Ses akışı yüklenirken hata oluştu.");
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("error", onError);
      audio.src = "";
    };
  }, []);

  // Sync playbackRate & volume to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const activeChapter = useMemo(() => {
    if (chapters.length === 0) return null;
    const ms = currentTime * 1000;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (ms >= chapters[i].startMs) return chapters[i];
    }
    return chapters[0];
  }, [chapters, currentTime]);

  const syncPositionNow = useCallback(async () => {
    const book = currentBookRef.current;
    const audio = audioRef.current;
    if (!book || !audio || !Number.isFinite(audio.currentTime)) return;
    const positionMs = Math.round(audio.currentTime * 1000);
    try {
      await fetch("/api/bookmarks/position", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumableId: book.id, positionMs }),
      });
      lastSyncRef.current = Date.now();
    } catch {
      // non-fatal
    }
  }, []);

  // Periodic position sync & listening stats every 15s while playing
  useEffect(() => {
    if (!isPlaying || !currentBook) return;
    const interval = setInterval(() => {
      listeningAccRef.current += 15;
      void syncPositionNow();
      const audio = audioRef.current;
      void fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seconds: 15,
          book: {
            id: currentBook.id,
            title: currentBook.title,
            authors: currentBook.authors,
            coverUrl: currentBook.coverUrl,
            positionMs: Math.round((audio?.currentTime || 0) * 1000),
            durationMs:
              Math.round((audio?.duration || 0) * 1000) || currentBook.durationMs,
          },
        }),
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [isPlaying, currentBook, syncPositionNow]);

  // Sync position on tab close via sendBeacon
  useEffect(() => {
    const handleUnload = () => {
      const book = currentBookRef.current;
      const audio = audioRef.current;
      if (!book || !audio || !audio.currentTime) return;
      const payload = JSON.stringify({
        consumableId: book.id,
        positionMs: Math.round(audio.currentTime * 1000),
      });
      navigator.sendBeacon?.(
        "/api/bookmarks/position",
        new Blob([payload], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Sleep timer ticker
  useEffect(() => {
    if (sleepTimer.type === "off") return;

    if (sleepTimer.type === "countdown") {
      const timer = setInterval(() => {
        const remaining = Math.max(
          0,
          Math.ceil((sleepTimer.endsAt - Date.now()) / 1000),
        );
        if (remaining <= 0) {
          audioRef.current?.pause();
          void syncPositionNow();
          setSleepTimer({ type: "off" });
        } else {
          setSleepTimer((prev) =>
            prev.type === "countdown"
              ? { ...prev, remainingSec: remaining }
              : prev,
          );
        }
      }, 1000);
      return () => clearInterval(timer);
    }

    if (
      sleepTimer.type === "end_of_chapter" &&
      activeChapter &&
      activeChapter.index !== sleepTimer.chapterIndex
    ) {
      audioRef.current?.pause();
      void syncPositionNow();
      setSleepTimer({ type: "off" });
    }
  }, [sleepTimer, activeChapter, syncPositionNow]);

  const playBook = useCallback(
    async (book: PlayingBook, startSeconds?: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      // Sync previous book position before switching
      if (currentBookRef.current && currentBookRef.current.id !== book.id) {
        void syncPositionNow();
      }

      setError(null);
      setIsBuffering(true);
      setCurrentBook(book);
      setChapters([]);
      setBookmarks([]);
      setSleepTimer({ type: "off" });
      if (book.durationMs > 0) {
        setDuration(book.durationMs / 1000);
      }

      // Fetch metadata (position, chapters, bookmarks) in parallel
      let initialSec =
        typeof startSeconds === "number"
          ? startSeconds
          : (book.positionMs ?? 0) / 1000;

      try {
        const detailRes = await fetch(`/api/books/${encodeURIComponent(book.id)}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          if (Array.isArray(detail.chapters)) setChapters(detail.chapters);
          if (Array.isArray(detail.bookmarks)) setBookmarks(detail.bookmarks);
          if (
            typeof startSeconds !== "number" &&
            typeof detail.positionMs === "number" &&
            detail.positionMs > 0
          ) {
            initialSec = detail.positionMs / 1000;
          }
          if (detail.durationMs > 0) {
            setDuration(detail.durationMs / 1000);
          }
        }
      } catch {
        // continue with stream
      }

      pendingSeekRef.current = initialSec;
      setCurrentTime(initialSec);

      const query = book.abookId
        ? `?abookId=${encodeURIComponent(book.abookId)}`
        : "";
      audio.src = `/api/stream/${encodeURIComponent(book.id)}${query}`;
      audio.playbackRate = playbackRate;
      audio.volume = isMuted ? 0 : volume;

      try {
        await audio.play();
      } catch {
        setIsBuffering(false);
      }
    },
    [playbackRate, volume, isMuted, syncPositionNow],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentBookRef.current) return;
    if (audio.paused) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
      void syncPositionNow();
    }
  }, [syncPositionNow]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || duration || seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const skip = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seek((audio.currentTime || 0) + deltaSeconds);
    },
    [seek],
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const clamped = Math.max(0.5, Math.min(3, Math.round(rate * 20) / 20));
    setPlaybackRateState(clamped);
    try {
      localStorage.setItem(RATE_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0) setIsMuted(false);
    try {
      localStorage.setItem(VOL_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  const setSleepMinutes = useCallback((minutes: number | null) => {
    if (!minutes || minutes <= 0) {
      setSleepTimer({ type: "off" });
      return;
    }
    const endsAt = Date.now() + minutes * 60 * 1000;
    setSleepTimer({ type: "countdown", endsAt, remainingSec: minutes * 60 });
  }, []);

  const setSleepEndOfChapter = useCallback(() => {
    if (!activeChapter) return;
    setSleepTimer({ type: "end_of_chapter", chapterIndex: activeChapter.index });
  }, [activeChapter]);

  const jumpToChapter = useCallback(
    (chapter: BookChapter) => {
      seek(chapter.startMs / 1000);
      if (audioRef.current?.paused) {
        void audioRef.current.play().catch(() => {});
      }
    },
    [seek],
  );

  const refreshBookmarks = useCallback(async () => {
    const book = currentBookRef.current;
    if (!book) return;
    try {
      const res = await fetch(`/api/bookmarks/${encodeURIComponent(book.id)}`);
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const addQuickBookmark = useCallback(async (note: string): Promise<boolean> => {
    const book = currentBookRef.current;
    const audio = audioRef.current;
    if (!book || !audio) return false;
    try {
      const res = await fetch(`/api/bookmarks/${encodeURIComponent(book.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionMs: Math.round((audio.currentTime || 0) * 1000),
          note,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const deleteBookmark = useCallback(async (bookmarkId: string) => {
    const book = currentBookRef.current;
    if (!book) return;
    try {
      const res = await fetch(
        `/api/bookmarks/${encodeURIComponent(book.id)}/${encodeURIComponent(bookmarkId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      }
    } catch {
      // ignore
    }
  }, []);

  const stopPlayer = useCallback(() => {
    void syncPositionNow();
    try {
      localStorage.removeItem(LAST_PLAYED_STORAGE_KEY);
    } catch {}
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setCurrentBook(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setChapters([]);
    setBookmarks([]);
    setSleepTimer({ type: "off" });
  }, [syncPositionNow]);

  // Reset active player state when switching profiles so previous profile's playback doesn't leak
  useEffect(() => {
    const onProfileSwitch = () => {
      try {
        localStorage.removeItem(LAST_PLAYED_STORAGE_KEY);
      } catch {}
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      setCurrentBook(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setChapters([]);
      setBookmarks([]);
      setSleepTimer({ type: "off" });
    };
    window.addEventListener("profile-switched", onProfileSwitch);
    return () => window.removeEventListener("profile-switched", onProfileSwitch);
  }, []);

  // Windows / OS Media Session API integration (hardware media keys!)
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentBook) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeChapter
        ? `${currentBook.title} · ${activeChapter.title}`
        : currentBook.title,
      artist: currentBook.authors || "Storytel",
      album: "Storytel Studio",
      artwork: currentBook.coverUrl
        ? [{ src: currentBook.coverUrl, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      void audioRef.current?.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
      void syncPositionNow();
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(30));
    navigator.mediaSession.setActionHandler("seekto", (d) => {
      if (typeof d.seekTime === "number") seek(d.seekTime);
    });
  }, [currentBook, activeChapter, skip, seek, syncPositionNow]);

  // Keyboard shortcuts (ignored when typing in inputs/textareas)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!currentBookRef.current) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        skip(-15);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        skip(30);
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, skip, toggleMute]);

  return (
    <PlayerContext.Provider
      value={{
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
        playBook,
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
        refreshBookmarks,
        syncPositionNow,
        stopPlayer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

export function toPlayingBook(book: BookshelfBook): PlayingBook {
  return {
    id: book.id,
    abookId: book.abookId,
    title: book.title,
    authors: book.authors,
    narrators: book.narrators,
    coverUrl: book.coverUrl,
    durationMs: book.durationMs,
    positionMs: book.positionMs,
  };
}
