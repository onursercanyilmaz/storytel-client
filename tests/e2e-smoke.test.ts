import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-e2e-test-"));

let serverProc: ChildProcess | null = null;

async function waitForServer(url: string, timeoutMs = 35000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Next.js server did not become ready in time");
}

test.before(async () => {
  const runner = path.join(process.cwd(), "scripts", "start-server.js");
  serverProc = spawn(process.execPath, [runner], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      STORYTEL_DATA_DIR: tempDir,
    },
    stdio: "ignore",
  });
  await waitForServer(`${BASE_URL}/api/auth/me`);
});

test.after(() => {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("E2E: Home page, PWA manifest, and SVG icon serve cleanly", async () => {
  const home = await fetch(`${BASE_URL}/`);
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes("Storytel"));

  const manifest = await fetch(`${BASE_URL}/manifest.json`);
  assert.equal(manifest.status, 200);
  const mJson = await manifest.json();
  assert.equal(mJson.name, "Storytel");

  const icon = await fetch(`${BASE_URL}/icon.svg`);
  assert.equal(icon.status, 200);

  const favicon = await fetch(`${BASE_URL}/favicon.ico`);
  assert.equal(favicon.status, 200);
});

test("E2E: Auth status & SSO status work when logged out", async () => {
  const me = await fetch(`${BASE_URL}/api/auth/me`);
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { authenticated: false });

  const sso = await fetch(`${BASE_URL}/api/auth/sso/status`);
  assert.equal(sso.status, 200);
  const ssoJson = await sso.json();
  assert.equal(ssoJson.state, "idle");
});

test("E2E: All protected API endpoints strictly enforce 401 Unauthorized", async () => {
  const endpoints = [
    ["GET", "/api/bookshelf"],
    ["GET", "/api/search?q=dune"],
    ["GET", "/api/books/12345"],
    ["GET", "/api/stream/12345"],
    ["GET", "/api/collections"],
    ["GET", "/api/downloads"],
    ["GET", "/api/stats"],
    ["GET", "/api/profiles"],
    ["GET", "/api/vocabulary"],
    ["POST", "/api/profiles/switch"],
    ["POST", "/api/favorites"],
    ["POST", "/api/bookshelf/add"],
    ["POST", "/api/bookshelf/remove"],
  ] as const;

  for (const [method, ep] of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : {},
      body: method === "POST" ? "{}" : undefined,
    });
    assert.equal(
      res.status,
      401,
      `Expected 401 for ${method} ${ep}, got ${res.status}`,
    );
  }
});

test("E2E: Email login validates input with 400 Bad Request", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "" }),
  });
  assert.equal(res.status, 400);
});

test("E2E: Single login persists across profile switches & book-specific vocabulary works", async () => {
  process.env.STORYTEL_DATA_DIR = tempDir;
  const { saveLegacySession, clearStoredSession } = await import("../src/lib/session");
  saveLegacySession({
    email: "test@example.com",
    jwt: "fake-jwt",
    singleSignToken: "fake-sst",
  });

  try {
    // 1. Auth should be true even without initial cookie (auto-heal from session.enc)
    const me1 = await fetch(`${BASE_URL}/api/auth/me`);
    assert.equal(me1.status, 200);
    const meJson1 = await me1.json();
    assert.equal(meJson1.authenticated, true);
    assert.equal(meJson1.email, "test@example.com");

    // 2. Get profiles
    const profRes = await fetch(`${BASE_URL}/api/profiles`);
    assert.equal(profRes.status, 200);
    const profJson = await profRes.json();
    assert.ok(Array.isArray(profJson.profiles));
    assert.ok(profJson.profiles.some((p: any) => p.id === "p-kid"));

    // 3. Switch to Kid profile
    const switchRes = await fetch(`${BASE_URL}/api/profiles/switch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: "p-kid" }),
    });
    assert.equal(switchRes.status, 200);
    const switchJson = await switchRes.json();
    assert.equal(switchJson.activeProfile.id, "p-kid");

    // 4. Auth MUST remain true after switching to Kid profile (no logout!)
    const me2 = await fetch(`${BASE_URL}/api/auth/me`);
    assert.equal(me2.status, 200);
    const meJson2 = await me2.json();
    assert.equal(meJson2.authenticated, true);

    // 5. Book-specific vocabulary add & filter on p-kid
    const addRes = await fetch(`${BASE_URL}/api/vocabulary`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        word: "ephemeral",
        meaning: "kısa ömürlü",
        bookId: "999001",
        bookTitle: "Test Book",
      }),
    });
    assert.equal(addRes.status, 201);

    const listMatch = await fetch(`${BASE_URL}/api/vocabulary?bookId=999001`);
    assert.equal(listMatch.status, 200);
    const matchJson = await listMatch.json();
    assert.equal(matchJson.words.length, 1);
    assert.equal(matchJson.words[0].word, "ephemeral");

    const listOther = await fetch(`${BASE_URL}/api/vocabulary?bookId=888002`);
    assert.equal(listOther.status, 200);
    const otherJson = await listOther.json();
    assert.equal(otherJson.words.length, 0);
  } finally {
    clearStoredSession();
  }
});
