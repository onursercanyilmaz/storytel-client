import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-crypto-test-"));
process.env.STORYTEL_DATA_DIR = tempDir;

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("AES-256-GCM encryptJson/decryptJson round-trip with Turkish Unicode", async () => {
  const { encryptJson, decryptJson } = await import("../src/lib/crypto");
  const original = {
    email: "çağrı@örnek.com",
    token: "secret-refresh-token-12345",
    nested: { items: ["Şeker Portakalı", "İnce Memed"] },
  };

  const encrypted = encryptJson(original);
  assert.equal(encrypted.includes("secret-refresh-token-12345"), false);
  assert.equal(encrypted.includes("Şeker Portakalı"), false);

  const decrypted = decryptJson<typeof original>(encrypted);
  assert.deepEqual(decrypted, original);
});

test("AES-256-GCM rejects tampered ciphertext or auth tag", async () => {
  const { encryptJson, decryptJson } = await import("../src/lib/crypto");
  const encrypted = encryptJson({ secret: "top-secret" });
  const parsed = JSON.parse(encrypted);

  // Tamper ciphertext
  const tamperedCt = JSON.stringify({
    ...parsed,
    ct: Buffer.from("tampered-data").toString("base64"),
  });
  assert.equal(decryptJson(tamperedCt), null);

  // Tamper auth tag
  const tamperedTag = JSON.stringify({
    ...parsed,
    tag: Buffer.alloc(16, 0).toString("base64"),
  });
  assert.equal(decryptJson(tamperedTag), null);
});

test("encryptStorytelLegacyPassword produces deterministic uppercase hex", async () => {
  const { encryptStorytelLegacyPassword } = await import("../src/lib/crypto");
  const out1 = encryptStorytelLegacyPassword("test1234");
  const out2 = encryptStorytelLegacyPassword("test1234");
  assert.equal(out1, out2);
  assert.match(out1, /^[0-9A-F]{32}$/);
});

test("redactUrl masks sensitive query parameters", async () => {
  const { redactUrl } = await import("../src/lib/crypto");
  const dirty =
    "https://www.storytel.com/api/login.action?uid=a@b.com&pwd=SECRET123&token=TOK456&key=APIKEY789";
  const clean = redactUrl(dirty);
  assert.equal(clean.includes("SECRET123"), false);
  assert.equal(clean.includes("TOK456"), false);
  assert.equal(clean.includes("APIKEY789"), false);
  assert.ok(clean.includes("pwd=***"));
  assert.ok(clean.includes("token=***"));
  assert.ok(clean.includes("key=***"));
});

test("generateSessionId produces unique high-entropy tokens", async () => {
  const { generateSessionId } = await import("../src/lib/crypto");
  const a = generateSessionId();
  const b = generateSessionId();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40);
});
