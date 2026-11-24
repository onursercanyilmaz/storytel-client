import { encryptStorytelLegacyPassword } from "../crypto";
import type { LegacyCredentials, SsoCredentials, StoredSession } from "../session";
import type {
  BookBookmark,
  BookChapter,
  BookStatus,
  BookshelfBook,
  SearchResultBook,
} from "./types";

const STORYTEL_HEADERS: Record<string, string> = {
  "x-storytel-terminal": "ios",
  "user-agent": "Storytel/25.38.0 (iOS 26.0; iPhone16,2) Release/924.1",
};

const FIREBASE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";
const FIREBASE_TOKEN_BUFFER_SEC = 60;

const WEB_SEARCH_BASE_URLS: Record<string, string> = {
  dk: "https://mofibo.com/dk/da",
};

function webSearchBaseUrl(country: string): string {
  return (
    WEB_SEARCH_BASE_URLS[country] ??
    `https://www.storytel.com/${country}/${country}`
  );
}

export class StorytelUnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = "Storytel oturumu sona erdi. Lütfen tekrar giriş yapın.") {
    super(message);
    this.name = "StorytelUnauthorizedError";
  }
}

// Module-level caches with single-flight promise deduplication
const firebaseTokenCache = new Map<
  string,
  { token: string; expiresAt: number }
>();
const firebaseInFlight = new Map<string, Promise<string>>();

function decodeJwtPayload(token?: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function countryFromJwt(token?: string | null): string | undefined {
  const payload = decodeJwtPayload(token);
  if (!payload) return undefined;
  if (typeof payload.store === "string") {
    const code = payload.store.split("-").pop()?.trim().toLowerCase();
    if (code && /^[a-z]{2}$/.test(code)) return code;
  }
  for (const claim of [payload.country, payload.countryCode]) {
    if (typeof claim === "string" && /^[a-z]{2}$/i.test(claim.trim())) {
      return claim.trim().toLowerCase();
    }
  }
  return undefined;
}

function extractLanguage(
  model: any,
  raw?: any,
): { language: string; languageName: string } {
  const formats: any[] = Array.isArray(model?.formats)
    ? model.formats
    : Array.isArray(raw?.formats)
      ? raw.formats
      : [];
  const formatLang = formats.find((f) => f?.language)?.language;
  const langObj =
    model?.language ??
    (Array.isArray(model?.languages) ? model.languages[0] : null) ??
    formatLang ??
    raw?.language ??
    raw?.book?.language;

  if (typeof langObj === "string") {
    const code = langObj.toLowerCase().trim();
    return { language: code, languageName: code.toUpperCase() };
  }
  if (langObj && typeof langObj === "object") {
    const code = String(
      langObj.isoValue || langObj.iso || langObj.code || langObj.id || "",
    )
      .toLowerCase()
      .trim();
    const name = String(
      langObj.localizedName || langObj.name || langObj.title || code.toUpperCase(),
    );
    return { language: code, languageName: name };
  }
  return { language: "", languageName: "" };
}

function normalizeCoverUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://www.storytel.com${url.startsWith("/") ? "" : "/"}${url}`;
}

export class StorytelClient {
  private sso: SsoCredentials | null;
  private legacy: LegacyCredentials | null;

  constructor(session: StoredSession) {
    this.sso = session.authMode === "sso" ? (session.sso ?? null) : null;
    this.legacy = session.authMode === "legacy" ? (session.legacy ?? null) : null;
  }

  static async loginWithEmailPassword(
    email: string,
    password: string,
  ): Promise<LegacyCredentials> {
    const trimmedEmail = email.trim();
    const encPwd = encryptStorytelLegacyPassword(password.trim());
    const params = new URLSearchParams({
      m: "1",
      uid: trimmedEmail,
      pwd: encPwd,
      version: "25.38.0",
    });

    const res = await fetch(
      `https://www.storytel.com/api/login.action?${params.toString()}`,
      {
        headers: STORYTEL_HEADERS,
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      },
    );

    if (res.status === 401 || res.status === 403) {
      throw new StorytelUnauthorizedError("E-posta veya şifre hatalı.");
    }
    if (!res.ok) {
      throw new Error(`Storytel giriş hatası (HTTP ${res.status})`);
    }
    const data = (await res.json()) as {
      accountInfo?: { jwt?: string; singleSignToken?: string };
    };
    const jwt = data?.accountInfo?.jwt;
    const singleSignToken = data?.accountInfo?.singleSignToken;
    if (!jwt || !singleSignToken) {
      throw new StorytelUnauthorizedError("Giriş bilgileri doğrulanamadı.");
    }
    return { email: trimmedEmail, jwt, singleSignToken };
  }

  private getLegacyToken(): string {
    if (this.sso) return this.sso.storytelSession;
    return this.legacy?.singleSignToken ?? "";
  }

  private async ensureFirebaseIdToken(forceRefresh = false): Promise<string> {
    if (!this.sso) {
      throw new StorytelUnauthorizedError("SSO oturumu bulunamadı.");
    }
    const cacheKey = `${this.sso.firebaseApiKey}:${this.sso.firebaseRefreshToken}`;
    const now = Math.floor(Date.now() / 1000);

    if (!forceRefresh) {
      const cached = firebaseTokenCache.get(cacheKey);
      if (cached && cached.expiresAt - FIREBASE_TOKEN_BUFFER_SEC > now) {
        return cached.token;
      }
      const inFlight = firebaseInFlight.get(cacheKey);
      if (inFlight) return inFlight;
    } else {
      firebaseTokenCache.delete(cacheKey);
    }

    const promise = (async () => {
      try {
        const body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.sso!.firebaseRefreshToken,
        });
        const res = await fetch(
          `${FIREBASE_TOKEN_URL}?key=${encodeURIComponent(this.sso!.firebaseApiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: "https://www.storytel.com/",
              Origin: "https://www.storytel.com",
            },
            body: body.toString(),
            signal: AbortSignal.timeout(15000),
          },
        );

        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new StorytelUnauthorizedError(
            "Google/Firebase oturumu geçersiz. Lütfen tekrar giriş yapın.",
          );
        }
        if (!res.ok) {
          throw new Error(`Firebase token yenileme hatası (HTTP ${res.status})`);
        }

        const data = (await res.json()) as {
          id_token?: string;
          access_token?: string;
          expires_in?: string;
        };
        const token = data.id_token ?? data.access_token;
        if (!token) {
          throw new StorytelUnauthorizedError("Firebase ID token alınamadı.");
        }
        const expiresIn = parseInt(data.expires_in ?? "3600", 10) || 3600;
        firebaseTokenCache.set(cacheKey, {
          token,
          expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
        });
        return token;
      } finally {
        firebaseInFlight.delete(cacheKey);
      }
    })();

    firebaseInFlight.set(cacheKey, promise);
    return promise;
  }

  async getBearerToken(forceRefresh = false): Promise<string> {
    if (this.sso) return this.ensureFirebaseIdToken(forceRefresh);
    if (this.legacy?.jwt) return this.legacy.jwt;
    throw new StorytelUnauthorizedError();
  }

  private async apiFetch(
    url: string,
    init: RequestInit = {},
    allowRedirect = false,
  ): Promise<Response> {
    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = url.includes("version=") ? url : `${url}${separator}version=25.38.0`;

    const doRequest = async (forceRefresh: boolean) => {
      const bearer = await this.getBearerToken(forceRefresh);
      const headers = new Headers(init.headers);
      for (const [k, v] of Object.entries(STORYTEL_HEADERS)) {
        if (!headers.has(k)) headers.set(k, v);
      }
      headers.set("Authorization", `Bearer ${bearer}`);
      if (!headers.has("Accept")) headers.set("Accept", "*/*");

      return fetch(fullUrl, {
        ...init,
        headers,
        redirect: allowRedirect ? "follow" : "manual",
        signal: init.signal ?? AbortSignal.timeout(25000),
      });
    };

    let res = await doRequest(false);
    if (res.status === 401 && this.sso) {
      res = await doRequest(true);
    }
    if (res.status === 401) {
      throw new StorytelUnauthorizedError();
    }
    return res;
  }

  async getMarketCountryCode(): Promise<string> {
    const candidates: (string | null | undefined)[] = [
      this.sso?.storytelSession,
      this.legacy?.jwt,
    ];
    try {
      candidates.unshift(await this.getBearerToken());
    } catch {
      // ignore
    }
    for (const token of candidates) {
      const code = countryFromJwt(token);
      if (code) return code;
    }
    return "tr";
  }

  private async fetchBookshelfSnapshot(): Promise<any> {
    const res = await this.apiFetch(
      "https://api.storytel.net/libraries/bookshelf",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "",
      },
    );
    if (!res.ok) {
      throw new Error(`Kitaplık alınamadı (HTTP ${res.status})`);
    }
    return res.json();
  }

  private async postBookshelfDelta(body: Record<string, unknown>): Promise<any> {
    const res = await this.apiFetch(
      "https://api.storytel.net/libraries/bookshelf",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`Kitaplık güncellenemedi (HTTP ${res.status})`);
    }
    return res.json();
  }

  async getBookshelf(): Promise<BookshelfBook[]> {
    const data = await this.fetchBookshelfSnapshot();
    const items = data?.items;
    if (!items || typeof items !== "object") return [];

    const stateMap: Record<string, BookStatus> = {
      WILL_CONSUME: "will_consume",
      TO_READ: "will_consume",
      CONSUMING: "consuming",
      READING: "consuming",
      CONSUMED: "consumed",
      FINISHED: "consumed",
      COMPLETED: "consumed",
    };

    const books: BookshelfBook[] = [];
    for (const entry of Object.values(items) as any[]) {
      const model = entry?.model;
      if (!model || !model.id) continue;

      const formats: any[] = Array.isArray(model.formats) ? model.formats : [];
      const abook = formats.find((f) => f.type === "abook");
      const ebook = formats.find((f) => f.type === "ebook");

      const durationMs = Number(abook?.durationInMilliseconds ?? 0);
      const positionMs = Number(abook?.position?.position ?? 0);
      const progress =
        durationMs > 0
          ? Math.min(100, Math.round((positionMs / durationMs) * 100))
          : 0;

      const normalizedState = String(model.state ?? "").toUpperCase();
      let status: BookStatus =
        stateMap[normalizedState] ??
        (positionMs > 0 ? "consuming" : "will_consume");
      if (progress >= 99 && status === "consuming") {
        status = "consumed";
      }

      const joinNames = (arr?: any[]) =>
        Array.isArray(arr)
          ? arr
              .map((x) => x?.name)
              .filter(Boolean)
              .join(", ")
          : "";

      const { language, languageName } = extractLanguage(model);

      books.push({
        id: String(model.id),
        abookId: abook?.id ? String(abook.id) : null,
        title: String(model.title ?? "İsimsiz Kitap"),
        authors: joinNames(model.authors),
        narrators: joinNames(model.narrators),
        coverUrl: normalizeCoverUrl(
          abook?.cover?.url ?? ebook?.cover?.url ?? model.cover?.url ?? "",
        ),
        category: String(model.category?.name ?? ""),
        language,
        languageName,
        status,
        durationMs,
        positionMs,
        progress,
        stateUpdateTime: model.stateUpdateTime,
        positionUpdatedTime: abook?.position?.updatedTime,
        hasEbook: !!ebook,
      });
    }

    // Sort by most recent activity descending
    books.sort((a, b) => {
      const ta = new Date(a.positionUpdatedTime || a.stateUpdateTime || 0).getTime();
      const tb = new Date(b.positionUpdatedTime || b.stateUpdateTime || 0).getTime();
      return tb - ta;
    });

    return books;
  }

  async getBookDetails(consumableId: string): Promise<any> {
    const res = await this.apiFetch(
      `https://api.storytel.net/book-details/consumables/${encodeURIComponent(consumableId)}?kidsMode=false&configVariant=default`,
    );
    if (!res.ok) {
      throw new Error(`Kitap detayı alınamadı (HTTP ${res.status})`);
    }
    return res.json();
  }

  private deltaContains(data: any, id: string): boolean {
    const items = data?.items;
    if (!items || typeof items !== "object" || Array.isArray(items)) return false;
    return Object.entries(items).some(
      ([k, entry]: [string, any]) =>
        k === id || String(entry?.model?.id ?? "") === id,
    );
  }

  private async buildBookshelfModel(consumableId: string): Promise<Record<string, unknown>> {
    const base = {
      id: consumableId,
      state: "WILL_CONSUME",
      stateUpdateTime: new Date().toISOString(),
      deepLink: `storytel://book-details-page/book-details/consumables/${consumableId}`,
      resultType: "book",
    };
    try {
      const details = await this.getBookDetails(consumableId);
      return {
        ...base,
        title: details?.title ?? "",
        shareUrl: details?.shareUrl ?? "",
        kidsBook: !!details?.kidsBook,
        authors: Array.isArray(details?.authors) ? details.authors : [],
        narrators: Array.isArray(details?.narrators) ? details.narrators : [],
        formats: Array.isArray(details?.formats) ? details.formats : [],
        duration: details?.duration,
        category: details?.category,
        language: details?.language,
      };
    } catch {
      return { ...base, kidsBook: false };
    }
  }

  async addToBookshelf(consumableId: string): Promise<boolean> {
    const id = String(consumableId);
    const current = await this.fetchBookshelfSnapshot();
    if (this.deltaContains(current, id)) return true;

    const model = await this.buildBookshelfModel(id);
    const res = await this.postBookshelfDelta({
      ...(current.resourceVersion ? { resourceVersion: current.resourceVersion } : {}),
      items: { [id]: { action: "SET", model } },
    });
    if (this.deltaContains(res, id)) return true;

    const verify = await this.fetchBookshelfSnapshot();
    return this.deltaContains(verify, id);
  }

  async removeFromBookshelf(consumableId: string): Promise<boolean> {
    const id = String(consumableId);
    let current = await this.fetchBookshelfSnapshot();
    if (!this.deltaContains(current, id)) return true;

    const actions: Array<() => Promise<Record<string, unknown>>> = [
      async () => ({ items: { [id]: { action: "DELETE" } } }),
      async () => ({ items: { [id]: { action: "REMOVE" } } }),
      async () => ({ items: { [id]: { action: "UNSET" } } }),
      async () => ({
        items: {
          [id]: { action: "DELETE", model: await this.buildBookshelfModel(id) },
        },
      }),
    ];

    for (const build of actions) {
      try {
        const body = await build();
        await this.postBookshelfDelta({
          ...(current.resourceVersion
            ? { resourceVersion: current.resourceVersion }
            : {}),
          ...body,
        });
        current = await this.fetchBookshelfSnapshot();
        if (!this.deltaContains(current, id)) return true;
      } catch (err) {
        if (err instanceof StorytelUnauthorizedError) throw err;
      }
    }
    return false;
  }

  async searchCatalog(query: string): Promise<SearchResultBook[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results: SearchResultBook[] = [];
    const seen = new Set<string>();

    const endpoints = [
      `https://api.storytel.net/search/v2?query=${encodeURIComponent(trimmed)}&configVariant=default`,
      `https://api.storytel.net/search/page?query=${encodeURIComponent(trimmed)}&kidsMode=false`,
      `https://api.storytel.net/search?query=${encodeURIComponent(trimmed)}&kidsMode=false`,
    ];

    for (const url of endpoints) {
      try {
        const res = await this.apiFetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const rawItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.results)
            ? data.results
            : [];

        for (const raw of rawItems) {
          const model = raw.model || raw.item || raw.book || raw;
          const id = String(
            model.id || model.consumableId || raw.id || raw.consumableId || "",
          );
          const title = String(
            model.title || model.name || raw.title || raw.name || "",
          );
          if (!id || !title || seen.has(id)) continue;

          const formats: any[] = Array.isArray(model.formats) ? model.formats : [];
          const abook = formats.find((f) => f.type === "abook");
          const ebook = formats.find((f) => f.type === "ebook");
          if (!abook) continue;

          seen.add(id);
          const { language, languageName } = extractLanguage(model, raw);

          results.push({
            id,
            title,
            authors: Array.isArray(model.authors)
              ? model.authors.map((a: any) => a?.name || a).join(", ")
              : "",
            narrators: Array.isArray(model.narrators)
              ? model.narrators.map((n: any) => n?.name || n).join(", ")
              : "",
            coverUrl: normalizeCoverUrl(
              abook?.cover?.url || ebook?.cover?.url || model.cover?.url || "",
            ),
            category: String(
              model.category?.name || model.category?.title || "",
            ),
            durationMs: Number(abook?.durationInMilliseconds || 0),
            description: String(model.description || ""),
            hasAbook: true,
            hasEbook: !!ebook,
            language,
            languageName,
          });
        }

        if (results.length > 0) return results;
      } catch (err) {
        if (err instanceof StorytelUnauthorizedError) throw err;
      }
    }

    // Fallback to country-scoped web search
    const country = await this.getMarketCountryCode();
    try {
      const res = await fetch(
        `${webSearchBaseUrl(country)}/api/search.action?q=${encodeURIComponent(trimmed)}`,
        {
          headers: { ...STORYTEL_HEADERS, Accept: "application/json" },
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.books)) {
          for (const item of data.books) {
            const book = item?.book || {};
            const abook = item?.abook || {};
            const ebook = item?.ebook || {};
            if (!abook.id && !item.abook) continue;

            const id = String(
              book.consumableId || book.id || abook.id || item.id || "",
            );
            const title = String(book.name || book.title || "");
            if (!id || !title || seen.has(id)) continue;
            seen.add(id);

            const { language, languageName } = extractLanguage(book, item);
            const durationMs = abook.length
              ? Number(abook.length)
              : abook.time
                ? Math.floor(Number(abook.time) / 1000)
                : 0;

            results.push({
              id,
              title,
              authors:
                book.authorsAsString ||
                (Array.isArray(book.authors)
                  ? book.authors.map((a: any) => a?.name || a).join(", ")
                  : ""),
              narrators:
                abook.narratorAsString ||
                (Array.isArray(abook.narrators)
                  ? abook.narrators.map((n: any) => n?.name || n).join(", ")
                  : ""),
              coverUrl: normalizeCoverUrl(
                book.largeCover || book.cover || book.smallCover || "",
              ),
              category: String(
                book.category?.title || book.category?.name || "",
              ),
              durationMs,
              description: String(abook.description || ebook.description || ""),
              hasAbook: true,
              hasEbook: !!ebook.id || !!item.ebook,
              language,
              languageName,
            });
          }
        }
      }
    } catch {
      // ignore fallback errors
    }

    return results;
  }

  async getChapters(consumableId: string): Promise<BookChapter[]> {
    const candidates = [
      `https://api.storytel.net/playback-metadata/consumables/${encodeURIComponent(consumableId)}`,
      `https://api.storytel.net/playback-metadata/v2/consumables/${encodeURIComponent(consumableId)}`,
      `https://api.storytel.net/consumables/${encodeURIComponent(consumableId)}/chapters`,
    ];

    for (const url of candidates) {
      try {
        const res = await this.apiFetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const rawChapters =
          data?.chapters ??
          data?.tracks ??
          data?.abook?.chapters ??
          data?.formats?.find((f: any) => f.type === "abook")?.chapters ??
          [];
        if (Array.isArray(rawChapters) && rawChapters.length > 0) {
          let cursorMs = 0;
          return rawChapters.map((ch: any, idx: number) => {
            const durationMs = Number(
              ch.durationInMilliseconds ?? ch.durationMs ?? ch.duration ?? 0,
            );
            const startMs =
              typeof ch.startInMilliseconds === "number"
                ? ch.startInMilliseconds
                : typeof ch.startMs === "number"
                  ? ch.startMs
                  : typeof ch.position === "number"
                    ? ch.position
                    : cursorMs;
            cursorMs = startMs + durationMs;
            return {
              index: idx,
              title: String(ch.title || ch.name || `Bölüm ${idx + 1}`),
              startMs,
              durationMs,
            };
          });
        }
      } catch (err) {
        if (err instanceof StorytelUnauthorizedError) throw err;
      }
    }
    return [];
  }

  async getAudioStreamUrl(consumableId: string, abookId?: string | null): Promise<string> {
    const url = `https://api.storytel.net/assets/v2/consumables/${encodeURIComponent(consumableId)}/abook`;
    const res = await this.apiFetch(url, { method: "GET" }, false);
    const location = res.headers.get("location");
    if (location) return location;

    // Fallback to legacy stream endpoint if abookId & legacy token available
    const legacyToken = this.getLegacyToken();
    const programId = abookId || consumableId;
    if (legacyToken) {
      const legacyRes = await fetch(
        `https://www.storytel.com/mp3streamRangeReq?startposition=0&programId=${encodeURIComponent(programId)}&token=${encodeURIComponent(legacyToken)}`,
        {
          headers: STORYTEL_HEADERS,
          redirect: "manual",
          signal: AbortSignal.timeout(20000),
        },
      );
      const legacyLoc = legacyRes.headers.get("location");
      if (legacyLoc) return legacyLoc;
    }

    throw new Error(
      `Ses akışı adresi alınamadı (HTTP ${res.status}). Kitap aboneliğinizde aktif olmayabilir.`,
    );
  }

  async getPositionalBookmark(consumableId: string): Promise<number> {
    try {
      const res = await this.apiFetch(
        `https://api.storytel.net/bookmarks/positional?kidsMode=false&orderBy=updated&orderDirection=desc&consumableIds=${encodeURIComponent(consumableId)}`,
      );
      if (!res.ok) return 0;
      const data = await res.json();
      const first = Array.isArray(data?.bookmarks) ? data.bookmarks[0] : null;
      return Number(first?.position ?? 0);
    } catch {
      return 0;
    }
  }

  async updatePositionalBookmark(
    consumableId: string,
    positionMs: number,
    deviceId: string,
  ): Promise<void> {
    const res = await this.apiFetch(
      "https://api.storytel.net/bookmarks/positional",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId,
          action: "player_paused",
          secondsSinceCreated: 0,
          position: Math.max(0, Math.round(positionMs)),
          type: "abook",
          kidsMode: false,
          consumableId,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Pozisyon kaydedilemedi (HTTP ${res.status})`);
    }
  }

  async getBookmarks(consumableId: string): Promise<BookBookmark[]> {
    try {
      const res = await this.apiFetch(
        `https://api.storytel.net/bookmarks/manual?type=abook&consumableId=${encodeURIComponent(consumableId)}`,
        {
          headers: { Accept: "application/vnd.storytel.bookmark+json;v=2.0" },
        },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data?.bookmarks) ? data.bookmarks : [];
      return list.map((b: any) => ({
        id: String(b.id),
        positionMs: Number(b.position ?? 0),
        note: String(b.note ?? ""),
        createdAt: b.createdTime || b.updatedTime,
      }));
    } catch {
      return [];
    }
  }

  async createBookmark(
    consumableId: string,
    positionMs: number,
    note: string,
  ): Promise<void> {
    const res = await this.apiFetch("https://api.storytel.net/bookmarks/manual", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Accept: "application/vnd.storytel.bookmark+json;v=2.0",
      },
      body: JSON.stringify({
        consumableId,
        position: Math.max(0, Math.round(positionMs)),
        note,
        type: "abook",
      }),
    });
    if (!res.ok) {
      throw new Error(`Yer imi eklenemedi (HTTP ${res.status})`);
    }
  }

  async updateBookmark(
    bookmarkId: string,
    consumableId: string,
    positionMs: number,
    note: string,
  ): Promise<void> {
    const res = await this.apiFetch(
      `https://api.storytel.net/bookmarks/manual/${encodeURIComponent(bookmarkId)}?id=${encodeURIComponent(bookmarkId)}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          Accept: "application/vnd.storytel.bookmark+json;v=2.0",
        },
        body: JSON.stringify({
          id: bookmarkId,
          consumableId,
          position: Math.max(0, Math.round(positionMs)),
          note,
          type: "abook",
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Yer imi güncellenemedi (HTTP ${res.status})`);
    }
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    const res = await this.apiFetch(
      `https://api.storytel.net/bookmarks/manual/${encodeURIComponent(bookmarkId)}?id=${encodeURIComponent(bookmarkId)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/vnd.storytel.bookmark+json;v=2.0" },
      },
    );
    if (!res.ok) {
      throw new Error(`Yer imi silinemedi (HTTP ${res.status})`);
    }
  }
}
