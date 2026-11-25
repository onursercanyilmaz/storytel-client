import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, ensureDataDirs } from "./paths";
import type { LocalAudiobook } from "./storytel/types";

const LOCAL_BOOKS_DIR = path.join(DATA_DIR, "local-audiobooks");
const INDEX_PATH = path.join(LOCAL_BOOKS_DIR, "index.json");

function ensureLocalBooksDir(): void {
  ensureDataDirs();
  if (!fs.existsSync(LOCAL_BOOKS_DIR)) {
    fs.mkdirSync(LOCAL_BOOKS_DIR, { recursive: true });
  }
}

export function listLocalAudiobooks(): LocalAudiobook[] {
  ensureLocalBooksDir();
  if (!fs.existsSync(INDEX_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as LocalAudiobook[];
    return Array.isArray(raw) ? raw.filter((b) => fs.existsSync(b.filePath)) : [];
  } catch {
    return [];
  }
}

export function saveLocalAudiobookBuffer(input: {
  fileName: string;
  title?: string;
  authors?: string;
  buffer: Buffer;
}): LocalAudiobook {
  ensureLocalBooksDir();
  const extMatch = input.fileName.toLowerCase().match(/\.(mp3|m4b|m4a)$/);
  const format = (extMatch?.[1] as "mp3" | "m4b" | "m4a") || "mp3";
  const id = `local-${crypto.randomUUID().slice(0, 8)}`;
  const safeBase = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const destPath = path.join(LOCAL_BOOKS_DIR, `${id}-${safeBase}`);

  fs.writeFileSync(destPath, input.buffer);

  const entry: LocalAudiobook = {
    id,
    title: input.title?.trim() || path.basename(input.fileName, path.extname(input.fileName)),
    authors: input.authors?.trim() || "Yerel Kitap",
    fileName: path.basename(input.fileName),
    filePath: destPath,
    bytes: input.buffer.length,
    format,
    addedAt: new Date().toISOString(),
  };

  const list = listLocalAudiobooks();
  list.unshift(entry);
  fs.writeFileSync(INDEX_PATH, JSON.stringify(list, null, 2), "utf8");
  return entry;
}

export function findLocalAudiobook(id: string): LocalAudiobook | null {
  return listLocalAudiobooks().find((b) => b.id === id) || null;
}

export function deleteLocalAudiobook(id: string): boolean {
  ensureLocalBooksDir();
  const list = listLocalAudiobooks();
  const target = list.find((b) => b.id === id);
  if (!target) return false;
  try {
    if (fs.existsSync(target.filePath)) fs.unlinkSync(target.filePath);
  } catch {}
  const next = list.filter((b) => b.id !== id);
  fs.writeFileSync(INDEX_PATH, JSON.stringify(next, null, 2), "utf8");
  return true;
}
