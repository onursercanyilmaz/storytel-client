import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, ensureDataDirs } from "./paths";
import { getActiveProfile, getProfileDir } from "./profiles";
import type {
  CustomCollection,
  ListeningStats,
  VocabEntry,
} from "./storytel/types";

interface LibraryMetaData {
  favorites: string[];
  collections: CustomCollection[];
}

function getScopedMetaPath(profileId?: string): string {
  const pid = profileId || getActiveProfile().id;
  const dir = getProfileDir(pid);
  const p = path.join(dir, "library-meta.json");
  if (pid === "p-main" && !fs.existsSync(p)) {
    const legacy = path.join(DATA_DIR, "library-meta.json");
    if (fs.existsSync(legacy)) {
      try {
        fs.copyFileSync(legacy, p);
      } catch {}
    }
  }
  return p;
}

function getScopedStatsPath(profileId?: string): string {
  const pid = profileId || getActiveProfile().id;
  const dir = getProfileDir(pid);
  const p = path.join(dir, "listening-stats.json");
  if (pid === "p-main" && !fs.existsSync(p)) {
    const legacy = path.join(DATA_DIR, "listening-stats.json");
    if (fs.existsSync(legacy)) {
      try {
        fs.copyFileSync(legacy, p);
      } catch {}
    }
  }
  return p;
}

function getScopedVocabPath(profileId?: string): string {
  const pid = profileId || getActiveProfile().id;
  const dir = getProfileDir(pid);
  const p = path.join(dir, "vocabulary.json");
  if (pid === "p-main" && !fs.existsSync(p)) {
    const legacy = path.join(DATA_DIR, "vocabulary.json");
    if (fs.existsSync(legacy)) {
      try {
        fs.copyFileSync(legacy, p);
      } catch {}
    }
  }
  return p;
}

function getScopedPositionsPath(profileId?: string): string {
  const pid = profileId || getActiveProfile().id;
  const dir = getProfileDir(pid);
  return path.join(dir, "playback-positions.json");
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureDataDirs();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDataDirs();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// --- Favorites & Custom Collections ---

export function getLibraryMeta(profileId?: string): LibraryMetaData {
  const p = getScopedMetaPath(profileId);
  const data = readJson<LibraryMetaData>(p, {
    favorites: [],
    collections: [],
  });
  return {
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    collections: Array.isArray(data.collections) ? data.collections : [],
  };
}

export function toggleFavorite(
  bookId: string,
  profileId?: string,
): { isFavorite: boolean; favorites: string[] } {
  const p = getScopedMetaPath(profileId);
  const meta = getLibraryMeta(profileId);
  const exists = meta.favorites.includes(bookId);
  if (exists) {
    meta.favorites = meta.favorites.filter((id) => id !== bookId);
  } else {
    meta.favorites.unshift(bookId);
  }
  writeJson(p, meta);
  return { isFavorite: !exists, favorites: meta.favorites };
}

export function createCollection(
  name: string,
  color = "#ff5a1f",
  icon = "folder",
  profileId?: string,
): CustomCollection {
  const p = getScopedMetaPath(profileId);
  const meta = getLibraryMeta(profileId);
  const collection: CustomCollection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    icon,
    bookIds: [],
    createdAt: new Date().toISOString(),
  };
  meta.collections.push(collection);
  writeJson(p, meta);
  return collection;
}

export function updateCollection(
  id: string,
  patch: {
    name?: string;
    color?: string;
    icon?: string;
    addBookId?: string;
    removeBookId?: string;
    toggleBookId?: string;
  },
  profileId?: string,
): CustomCollection | null {
  const p = getScopedMetaPath(profileId);
  const meta = getLibraryMeta(profileId);
  const col = meta.collections.find((c) => c.id === id);
  if (!col) return null;

  if (typeof patch.name === "string" && patch.name.trim()) {
    col.name = patch.name.trim();
  }
  if (typeof patch.color === "string" && patch.color.trim()) {
    col.color = patch.color.trim();
  }
  if (typeof patch.icon === "string" && patch.icon.trim()) {
    col.icon = patch.icon.trim();
  }
  if (patch.addBookId && !col.bookIds.includes(patch.addBookId)) {
    col.bookIds.unshift(patch.addBookId);
  }
  if (patch.removeBookId) {
    col.bookIds = col.bookIds.filter((b) => b !== patch.removeBookId);
  }
  if (patch.toggleBookId) {
    if (col.bookIds.includes(patch.toggleBookId)) {
      col.bookIds = col.bookIds.filter((b) => b !== patch.toggleBookId);
    } else {
      col.bookIds.unshift(patch.toggleBookId);
    }
  }

  writeJson(p, meta);
  return col;
}

export function deleteCollection(id: string, profileId?: string): boolean {
  const p = getScopedMetaPath(profileId);
  const meta = getLibraryMeta(profileId);
  const before = meta.collections.length;
  meta.collections = meta.collections.filter((c) => c.id !== id);
  if (meta.collections.length === before) return false;
  writeJson(p, meta);
  return true;
}

// --- Listening Stats ---

export function getListeningStats(profileId?: string): ListeningStats {
  const p = getScopedStatsPath(profileId);
  const data = readJson<ListeningStats>(p, {
    totalSeconds: 0,
    dailySeconds: {},
    recentBooks: [],
  });
  return {
    totalSeconds: Number(data.totalSeconds || 0),
    dailySeconds: data.dailySeconds || {},
    recentBooks: Array.isArray(data.recentBooks) ? data.recentBooks : [],
  };
}

export function recordListeningProgress(
  input: {
    seconds: number;
    book?: {
      id: string;
      title: string;
      authors: string;
      coverUrl: string;
      positionMs: number;
      durationMs: number;
    };
  },
  profileId?: string,
): ListeningStats {
  const p = getScopedStatsPath(profileId);
  const stats = getListeningStats(profileId);
  const sec = Math.max(0, Math.min(300, Math.round(input.seconds)));
  if (sec > 0) {
    const today = new Date().toISOString().slice(0, 10);
    stats.totalSeconds += sec;
    stats.dailySeconds[today] = (stats.dailySeconds[today] || 0) + sec;
  }

  if (input.book) {
    stats.recentBooks = [
      {
        ...input.book,
        lastPlayedAt: new Date().toISOString(),
      },
      ...stats.recentBooks.filter((b) => b.id !== input.book!.id),
    ].slice(0, 20);

    // Also persist position in profile-scoped positions store
    saveProfilePosition(
      input.book.id,
      input.book.positionMs,
      input.book.durationMs,
      profileId,
    );
  }

  writeJson(p, stats);
  return stats;
}

// --- Profile Playback Positions (Resume) ---

export interface StoredPosition {
  positionMs: number;
  durationMs?: number;
  updatedAt: string;
}

export function getAllProfilePositions(
  profileId?: string,
): Record<string, StoredPosition> {
  const p = getScopedPositionsPath(profileId);
  return readJson<Record<string, StoredPosition>>(p, {});
}

export function getProfilePosition(
  bookId: string,
  profileId?: string,
): StoredPosition | null {
  const dict = getAllProfilePositions(profileId);
  return dict[bookId] || null;
}

export function saveProfilePosition(
  bookId: string,
  positionMs: number,
  durationMs?: number,
  profileId?: string,
): void {
  const p = getScopedPositionsPath(profileId);
  const dict = getAllProfilePositions(profileId);
  dict[bookId] = {
    positionMs: Math.max(0, Math.round(positionMs)),
    durationMs: durationMs ? Math.round(durationMs) : undefined,
    updatedAt: new Date().toISOString(),
  };
  writeJson(p, dict);
}

// --- Vocabulary Builder ---

export function getVocabulary(profileId?: string): VocabEntry[] {
  const p = getScopedVocabPath(profileId);
  const list = readJson<VocabEntry[]>(p, []);
  return Array.isArray(list) ? list : [];
}

export function addVocabEntry(
  input: {
    word: string;
    meaning: string;
    phonetic?: string;
    context?: string;
    bookId?: string;
    bookTitle?: string;
  },
  profileId?: string,
): VocabEntry {
  const p = getScopedVocabPath(profileId);
  const list = getVocabulary(profileId);
  const normalized = input.word.trim();
  const existing = list.find(
    (v) => v.word.toLowerCase() === normalized.toLowerCase(),
  );
  if (existing) {
    if (input.meaning.trim()) existing.meaning = input.meaning.trim();
    if (input.context?.trim()) existing.context = input.context.trim();
    if (input.phonetic?.trim()) existing.phonetic = input.phonetic.trim();
    writeJson(p, list);
    return existing;
  }

  const entry: VocabEntry = {
    id: crypto.randomUUID(),
    word: normalized,
    meaning: input.meaning.trim(),
    phonetic: input.phonetic?.trim() || undefined,
    context: input.context?.trim() || undefined,
    bookId: input.bookId,
    bookTitle: input.bookTitle,
    mastered: false,
    createdAt: new Date().toISOString(),
  };
  list.unshift(entry);
  writeJson(p, list);
  return entry;
}

export function updateVocabEntry(
  id: string,
  patch: { word?: string; meaning?: string; context?: string; mastered?: boolean },
  profileId?: string,
): VocabEntry | null {
  const p = getScopedVocabPath(profileId);
  const list = getVocabulary(profileId);
  const item = list.find((v) => v.id === id);
  if (!item) return null;

  if (typeof patch.word === "string" && patch.word.trim()) {
    item.word = patch.word.trim();
  }
  if (typeof patch.meaning === "string") {
    item.meaning = patch.meaning.trim();
  }
  if (typeof patch.context === "string") {
    item.context = patch.context.trim();
  }
  if (typeof patch.mastered === "boolean") {
    item.mastered = patch.mastered;
  }

  writeJson(p, list);
  return item;
}

export function deleteVocabEntry(id: string, profileId?: string): boolean {
  const p = getScopedVocabPath(profileId);
  const list = getVocabulary(profileId);
  const next = list.filter((v) => v.id !== id);
  if (next.length === list.length) return false;
  writeJson(p, next);
  return true;
}
