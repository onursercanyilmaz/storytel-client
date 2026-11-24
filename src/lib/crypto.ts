import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, ensureDataDirs } from "./paths";

const MASTER_KEY_PATH = path.join(DATA_DIR, ".master.key");

// Storytel's legacy /api/login.action endpoint requires passwords encrypted
// with this fixed AES-128-CBC key/IV. We ONLY use this in-transit during
// email/password login and NEVER persist passwords to disk.
const STORYTEL_LEGACY_KEY = "VQZBJ6TD8M9WBUWT";
const STORYTEL_LEGACY_IV = "joiwef08u23j341a";

export function encryptStorytelLegacyPassword(password: string): string {
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    STORYTEL_LEGACY_KEY,
    STORYTEL_LEGACY_IV,
  );
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted.toUpperCase();
}

function getOrCreateMasterKey(): Buffer {
  ensureDataDirs();
  if (fs.existsSync(MASTER_KEY_PATH)) {
    const raw = fs.readFileSync(MASTER_KEY_PATH, "utf8").trim();
    const buf = Buffer.from(raw, "hex");
    if (buf.length === 32) return buf;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(MASTER_KEY_PATH, key.toString("hex"), {
    encoding: "utf8",
    mode: 0o600,
  });
  return key;
}

export function encryptJson<T>(data: T): string {
  const key = getOrCreateMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(data);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ciphertext.toString("base64"),
  });
}

export function decryptJson<T>(payload: string): T | null {
  try {
    const parsed = JSON.parse(payload) as {
      v: number;
      iv: string;
      tag: string;
      ct: string;
    };
    if (parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.ct) return null;
    const key = getOrCreateMasterKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(parsed.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.ct, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function redactUrl(url: string): string {
  return url
    .replace(/(pwd|token|key|refresh_token)=[^&]+/gi, "$1=***");
}
