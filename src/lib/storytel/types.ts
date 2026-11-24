export type BookStatus = "will_consume" | "consuming" | "consumed";

export interface BookshelfBook {
  id: string; // consumableId
  abookId: string | null;
  ebookId?: string | null;
  title: string;
  authors: string;
  narrators: string;
  coverUrl: string;
  category: string;
  language: string;
  languageName: string;
  status: BookStatus;
  durationMs: number;
  positionMs: number;
  progress: number; // 0..100
  stateUpdateTime?: string;
  positionUpdatedTime?: string;
  hasEbook: boolean;
  // Local enrichments
  isFavorite?: boolean;
  collectionIds?: string[];
  isDownloaded?: boolean;
  downloadedBytes?: number;
  audioBytes?: number | null;
  ebookBytes?: number | null;
}

export interface SearchResultBook {
  id: string;
  title: string;
  authors: string;
  narrators: string;
  coverUrl: string;
  category: string;
  durationMs: number;
  description: string;
  hasAbook: boolean;
  hasEbook: boolean;
  language: string;
  languageName: string;
  onBookshelf?: boolean;
  recommendationReason?: string;
}

export interface BookChapter {
  index: number;
  title: string;
  startMs: number;
  durationMs: number;
}

export interface BookBookmark {
  id: string;
  positionMs: number;
  note: string;
  createdAt?: string;
}

export interface BookDetailResponse {
  id: string;
  abookId: string | null;
  ebookId?: string | null;
  hasAbook?: boolean;
  hasEbook?: boolean;
  audioBytes?: number | null;
  ebookBytes?: number | null;
  title: string;
  authors: string;
  narrators: string;
  coverUrl: string;
  category: string;
  language: string;
  languageName: string;
  description: string;
  durationMs: number;
  positionMs: number;
  chapters: BookChapter[];
  bookmarks: BookBookmark[];
  isDownloaded: boolean;
  downloadedBytes?: number;
}

export interface CustomCollection {
  id: string;
  name: string;
  color: string;
  icon: string;
  bookIds: string[];
  createdAt: string;
}

export interface DownloadEntry {
  bookId: string;
  title: string;
  fileName: string;
  bytes: number;
  downloadedAt: string;
}

export interface ActiveDownload {
  bookId: string;
  title: string;
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  status: "downloading" | "completed" | "error" | "cancelled";
  error?: string;
}

export interface ListeningStats {
  totalSeconds: number;
  dailySeconds: Record<string, number>; // YYYY-MM-DD -> seconds
  recentBooks: {
    id: string;
    title: string;
    authors: string;
    coverUrl: string;
    lastPlayedAt: string;
    positionMs: number;
    durationMs: number;
  }[];
}

export interface VocabEntry {
  id: string;
  word: string;
  meaning: string;
  phonetic?: string;
  context?: string;
  bookId?: string;
  bookTitle?: string;
  mastered: boolean;
  createdAt: string;
}
