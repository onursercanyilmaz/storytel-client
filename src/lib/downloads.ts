import fs from "fs";
import path from "path";
import { DOWNLOADS_DIR, ensureDataDirs } from "./paths";
import type { ActiveDownload, DownloadEntry } from "./storytel/types";

const MAX_TITLE_LEN = 110;

interface ActiveDownloadInternal {
  state: ActiveDownload;
  controller: AbortController;
  partPath: string;
}

const globalForDownloads = globalThis as unknown as {
  __storytelActiveDownloads?: Map<string, ActiveDownloadInternal>;
};

function getActiveMap(): Map<string, ActiveDownloadInternal> {
  if (!globalForDownloads.__storytelActiveDownloads) {
    globalForDownloads.__storytelActiveDownloads = new Map();
  }
  return globalForDownloads.__storytelActiveDownloads;
}

export function isValidBookId(bookId: unknown): bookId is string {
  return typeof bookId === "string" && /^\d+$/.test(bookId);
}

function sanitizeTitle(title: string): string {
  return title
    .replace(/[<>:"/\\|?*#%\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LEN)
    .replace(/[. ]+$/, "");
}

function buildDownloadPath(bookId: string, title?: string): string {
  ensureDataDirs();
  const safe = title ? sanitizeTitle(title) : "";
  const fileName = safe ? `${safe} [${bookId}].mp3` : `${bookId}.mp3`;
  return path.join(DOWNLOADS_DIR, fileName);
}

export function findDownloadedFile(bookId: string): string | null {
  if (!isValidBookId(bookId)) return null;
  ensureDataDirs();
  const direct = path.join(DOWNLOADS_DIR, `${bookId}.mp3`);
  if (fs.existsSync(direct)) return direct;

  const suffix = ` [${bookId}].mp3`;
  const match = fs
    .readdirSync(DOWNLOADS_DIR)
    .find((name) => name.endsWith(suffix));
  return match ? path.join(DOWNLOADS_DIR, match) : null;
}

export function listDownloads(): {
  files: DownloadEntry[];
  active: ActiveDownload[];
  totalBytes: number;
} {
  ensureDataDirs();
  const files: DownloadEntry[] = [];
  let totalBytes = 0;

  for (const name of fs.readdirSync(DOWNLOADS_DIR)) {
    if (!name.endsWith(".mp3")) continue;
    const full = path.join(DOWNLOADS_DIR, name);
    try {
      const stat = fs.statSync(full);
      const match = name.match(/\[(\d+)\]\.mp3$/) || name.match(/^(\d+)\.mp3$/);
      if (!match) continue;
      const bookId = match[1];
      const title = name
        .replace(/\s*\[\d+\]\.mp3$/, "")
        .replace(/\.mp3$/, "");
      totalBytes += stat.size;
      files.push({
        bookId,
        title: title || `Kitap ${bookId}`,
        fileName: name,
        bytes: stat.size,
        downloadedAt: stat.mtime.toISOString(),
      });
    } catch {
      // ignore
    }
  }

  files.sort(
    (a, b) =>
      new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime(),
  );

  const active = Array.from(getActiveMap().values()).map((a) => a.state);
  return { files, active, totalBytes };
}

export function getDownloadStatus(bookId: string): {
  downloaded: boolean;
  bytes?: number;
  active?: ActiveDownload;
} {
  const filePath = findDownloadedFile(bookId);
  if (filePath) {
    try {
      const stat = fs.statSync(filePath);
      return { downloaded: true, bytes: stat.size };
    } catch {
      return { downloaded: true };
    }
  }
  const active = getActiveMap().get(bookId)?.state;
  return { downloaded: false, active };
}

export function startBackgroundDownload(
  bookId: string,
  title: string,
  streamUrl: string,
): ActiveDownload {
  const activeMap = getActiveMap();
  const existing = activeMap.get(bookId);
  if (existing && existing.state.status === "downloading") {
    return existing.state;
  }

  const finalPath = buildDownloadPath(bookId, title);
  const partPath = `${finalPath}.part`;
  const controller = new AbortController();

  const state: ActiveDownload = {
    bookId,
    title: title || `Kitap ${bookId}`,
    percentage: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    status: "downloading",
  };

  activeMap.set(bookId, { state, controller, partPath });

  void (async () => {
    let writeStream: fs.WriteStream | null = null;
    try {
      const res = await fetch(streamUrl, { signal: controller.signal });
      if (!res.ok || !res.body) {
        throw new Error(`İndirme başarısız (HTTP ${res.status})`);
      }

      const totalBytes = parseInt(res.headers.get("content-length") || "0", 10);
      state.totalBytes = totalBytes;

      writeStream = fs.createWriteStream(partPath);
      const reader = res.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          state.downloadedBytes += value.byteLength;
          if (totalBytes > 0) {
            state.percentage = Math.min(
              99,
              Math.round((state.downloadedBytes / totalBytes) * 100),
            );
          }
          if (!writeStream.write(value)) {
            await new Promise<void>((resolve) =>
              writeStream!.once("drain", resolve),
            );
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        writeStream!.end(() => resolve());
        writeStream!.on("error", reject);
      });

      fs.renameSync(partPath, finalPath);
      state.percentage = 100;
      state.status = "completed";
      setTimeout(() => activeMap.delete(bookId), 5000);
    } catch (err: any) {
      try {
        writeStream?.destroy();
      } catch {
        // ignore
      }
      try {
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
      } catch {
        // ignore
      }

      if (controller.signal.aborted) {
        state.status = "cancelled";
      } else {
        state.status = "error";
        state.error = err?.message || "İndirme hatası";
      }
      setTimeout(() => activeMap.delete(bookId), 5000);
    }
  })();

  return state;
}

export function cancelOrDeleteDownload(bookId: string): boolean {
  const activeMap = getActiveMap();
  const active = activeMap.get(bookId);
  if (active) {
    active.controller.abort();
    activeMap.delete(bookId);
    try {
      if (fs.existsSync(active.partPath)) fs.unlinkSync(active.partPath);
    } catch {
      // ignore
    }
    return true;
  }

  const filePath = findDownloadedFile(bookId);
  if (filePath) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}
