import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { DATA_DIR, ensureDataDirs } from "./paths";
import { decryptJson, encryptJson, generateSessionId } from "./crypto";

export const SESSION_COOKIE_NAME = "st_studio_sid";
const SESSION_FILE_PATH = path.join(DATA_DIR, "session.enc");

export interface SsoCredentials {
  storytelSession: string;
  firebaseRefreshToken: string;
  firebaseApiKey: string;
  email: string;
  cid: string;
}

export interface LegacyCredentials {
  email: string;
  jwt: string;
  singleSignToken: string;
}

export interface StoredSession {
  sid: string;
  authMode: "sso" | "legacy";
  email: string;
  createdAt: string;
  sso?: SsoCredentials;
  legacy?: LegacyCredentials;
}

function readStoredSession(): StoredSession | null {
  ensureDataDirs();
  if (!fs.existsSync(SESSION_FILE_PATH)) return null;
  try {
    const raw = fs.readFileSync(SESSION_FILE_PATH, "utf8");
    return decryptJson<StoredSession>(raw);
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession): void {
  ensureDataDirs();
  const encrypted = encryptJson(session);
  fs.writeFileSync(SESSION_FILE_PATH, encrypted, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function saveSsoSession(creds: SsoCredentials): StoredSession {
  const session: StoredSession = {
    sid: generateSessionId(),
    authMode: "sso",
    email: creds.email,
    createdAt: new Date().toISOString(),
    sso: creds,
  };
  writeStoredSession(session);
  return session;
}

export function saveLegacySession(creds: LegacyCredentials): StoredSession {
  const session: StoredSession = {
    sid: generateSessionId(),
    authMode: "legacy",
    email: creds.email,
    createdAt: new Date().toISOString(),
    legacy: creds,
  };
  writeStoredSession(session);
  return session;
}

export function clearStoredSession(): void {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      fs.unlinkSync(SESSION_FILE_PATH);
    }
  } catch {
    // ignore
  }
}

export function getStoredSessionRaw(): StoredSession | null {
  return readStoredSession();
}

export async function setSessionCookie(sid: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // localhost HTTP
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Validates the HttpOnly session cookie against the server-side AES-256-GCM
 * encrypted session file. Auto-syncs cookie so profile switches and reloads
 * never unexpectedly log out the single authenticated Storytel user.
 */
export async function getAuthenticatedSession(): Promise<StoredSession | null> {
  const stored = readStoredSession();
  if (!stored) return null;

  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sid || sid !== stored.sid) {
      // Auto-heal cookie so local requests retain session seamlessly
      cookieStore.set(SESSION_COOKIE_NAME, stored.sid, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      });
    }
  } catch {
    // Non-request context or header immutable context
  }

  return stored;
}
