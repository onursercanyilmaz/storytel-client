import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, ensureDataDirs } from "./paths";
import type { CustomCollection, ListeningStats } from "./storytel/types";

const LIBRARY_META_PATH = path.join(DATA_DIR, "library-meta.json");
const STATS_PATH = path.join(DATA_DIR, "listening-stats.json");

interface LibraryMetaData {
  favorites: string[];
  collections: CustomCollection[];
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
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// --- Favorites & Custom Collections ---

export function getLibraryMeta(): LibraryMetaData {
  const data = readJson<LibraryMetaData>(LIBRARY_META_PATH, {
    favorites: [],
    collections: [],
  });
  return {
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    collections: Array.isArray(data.collections) ? data.collections : [],
  };
}

export function toggleFavorite(bookId: string): { isFavorite: boolean; favorites: string[] } {
  const meta = getLibraryMeta();
  const exists = meta.favorites.includes(bookId);
  if (exists) {
    meta.favorites = meta.favorites.filter((id) => id !== bookId);
  } else {
    meta.favorites.unshift(bookId);
  }
  writeJson(LIBRARY_META_PATH, meta);
  return { isFavorite: !exists, favorites: meta.favorites };
}

export function createCollection(
  name: string,
  color = "#ff5a1f",
  icon = "folder",
): CustomCollection {
  const meta = getLibraryMeta();
  const collection: CustomCollection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    icon,
    bookIds: [],
    createdAt: new Date().toISOString(),
  };
  meta.collections.push(collection);
  writeJson(LIBRARY_META_PATH, meta);
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
): CustomCollection | null {
  const meta = getLibraryMeta();
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

  writeJson(LIBRARY_META_PATH, meta);
  return col;
}

export function deleteCollection(id: string): boolean {
  const meta = getLibraryMeta();
  const before = meta.collections.length;
  meta.collections = meta.collections.filter((c) => c.id !== id);
  if (meta.collections.length === before) return false;
  writeJson(LIBRARY_META_PATH, meta);
  return true;
}

// --- Listening Stats ---

export function getListeningStats(): ListeningStats {
  const data = readJson<ListeningStats>(STATS_PATH, {
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

export function recordListeningProgress(input: {
  seconds: number;
  book?: {
    id: string;
    title: string;
    authors: string;
    coverUrl: string;
    positionMs: number;
    durationMs: number;
  };
}): ListeningStats {
  const stats = getListeningStats();
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
  }

  writeJson(STATS_PATH, stats);
  return stats;
}
