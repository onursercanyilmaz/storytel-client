import test from "node:test";
import assert from "node:assert/strict";
import { StorytelClient } from "../src/lib/storytel/client";
import type { StoredSession } from "../src/lib/session";

function makeSsoSession(suffix = "1"): StoredSession {
  // Fake JWT payload: {"store":"STHP-TR","email":"test@example.com"}
  const payload = Buffer.from(
    JSON.stringify({ store: "STHP-TR", email: "test@example.com" }),
  ).toString("base64url");
  return {
    sid: `sid-${suffix}`,
    authMode: "sso",
    email: "test@example.com",
    createdAt: new Date().toISOString(),
    sso: {
      storytelSession: `hdr.${payload}.sig`,
      firebaseRefreshToken: `refresh-token-${suffix}`,
      firebaseApiKey: `api-key-${suffix}`,
      email: "test@example.com",
      cid: "cid-1",
    },
  };
}

test("StorytelClient single-flight Firebase refresh, 401 retry, bookshelf & search parsing", async () => {
  const originalFetch = globalThis.fetch;
  let firebaseCalls = 0;
  let bookshelfCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.startsWith("https://securetoken.googleapis.com/v1/token")) {
      firebaseCalls++;
      return new Response(
        JSON.stringify({
          id_token: `fb-id-token-${firebaseCalls}`,
          expires_in: "3600",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.startsWith("https://api.storytel.net/libraries/bookshelf")) {
      bookshelfCalls++;
      // Simulate 401 on very first call to verify automatic token refresh & retry
      if (bookshelfCalls === 1) {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response(
        JSON.stringify({
          resourceVersion: "v1",
          items: {
            "2001": {
              action: "SET",
              model: {
                id: "2001",
                title: "Sefiller",
                state: "CONSUMING",
                stateUpdateTime: "2026-01-02T10:00:00Z",
                authors: [{ id: "a1", name: "Victor Hugo" }],
                narrators: [{ id: "n1", name: "Mert Fırat" }],
                category: { id: 1, name: "Klasikler" },
                language: { isoValue: "tr", localizedName: "Türkçe" },
                formats: [
                  {
                    id: "ab-2001",
                    type: "abook",
                    durationInMilliseconds: 100000,
                    cover: { url: "https://covers.storytel.com/2001.jpg" },
                    position: {
                      position: 25000,
                      updatedTime: "2026-01-03T10:00:00Z",
                    },
                  },
                ],
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.startsWith("https://api.storytel.net/search/v2")) {
      return new Response(
        JSON.stringify({
          items: [
            {
              model: {
                id: "3001",
                title: "1984",
                authors: [{ name: "George Orwell" }],
                narrators: [{ name: "Okuyucu" }],
                language: { isoValue: "tr", localizedName: "Türkçe" },
                formats: [
                  {
                    id: "ab-3001",
                    type: "abook",
                    durationInMilliseconds: 36000000,
                    cover: { url: "https://covers.storytel.com/3001.jpg" },
                  },
                ],
              },
            },
            {
              // Ebook-only item should be filtered out
              model: {
                id: "3002",
                title: "Only Ebook",
                formats: [{ id: "eb-3002", type: "ebook" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.startsWith("https://api.storytel.net/assets/v2/consumables/2001/abook")) {
      assert.equal(init?.redirect, "manual");
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.storytel.net/signed/2001.mp3" },
      });
    }

    if (url.startsWith("https://api.storytel.net/playback-metadata/consumables/2001")) {
      return new Response(
        JSON.stringify({
          chapters: [
            { title: "Bölüm 1", durationInMilliseconds: 60000 },
            { title: "Bölüm 2", durationInMilliseconds: 40000 },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;

  try {
    const client = new StorytelClient(makeSsoSession("main"));

    // 1. Bookshelf triggers 401 -> refreshes Firebase token -> succeeds on retry
    const books = await client.getBookshelf();
    assert.equal(books.length, 1);
    assert.equal(books[0].title, "Sefiller");
    assert.equal(books[0].progress, 25);
    assert.equal(books[0].status, "consuming");
    assert.equal(books[0].language, "tr");
    assert.equal(bookshelfCalls, 2);
    assert.equal(firebaseCalls, 2); // initial + forced refresh on 401

    // 2. Subsequent calls reuse cached Firebase token & return both audiobooks and e-books
    const searchResults = await client.searchCatalog("1984");
    assert.equal(searchResults.length, 2);
    assert.equal(searchResults[0].id, "3001");
    assert.equal(searchResults[0].hasAbook, true);
    assert.equal(searchResults[1].id, "3002");
    assert.equal(searchResults[1].hasEbook, true);
    assert.equal(searchResults[1].hasAbook, false);
    assert.equal(firebaseCalls, 2);

    // 3. Audio stream returns 302 Location
    const streamUrl = await client.getAudioStreamUrl("2001");
    assert.equal(streamUrl, "https://cdn.storytel.net/signed/2001.mp3");

    // 4. Chapters accumulate startMs correctly
    const chapters = await client.getChapters("2001");
    assert.equal(chapters.length, 2);
    assert.equal(chapters[0].startMs, 0);
    assert.equal(chapters[1].startMs, 60000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
