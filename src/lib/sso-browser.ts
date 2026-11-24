import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import net from "net";
import { ensureDataDirs, SSO_PROFILE_DIR } from "./paths";
import { saveSsoSession, type StoredSession } from "./session";

export type SsoFlowState =
  | "idle"
  | "launching"
  | "waiting_login"
  | "capturing"
  | "success"
  | "cancelled"
  | "error";

export interface SsoFlowStatus {
  state: SsoFlowState;
  message: string;
  email?: string;
  sid?: string;
  error?: string;
}

const STORYTEL_LOGIN_URL = "https://www.storytel.com/tr/login";
const STORYTEL_STORAGE_TARGET = "https://www.storytel.com/tr/";
const FIREBASE_AUTH_PATH = /^\/__\/auth\//;
const LOGIN_PATH = /^\/[a-z]{2,3}\/login(\/|$)/;

function findBrowserExecutable(): string | null {
  const candidates =
    process.platform === "win32"
      ? [
          `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env.LocalAppData}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
          ];

  for (const exe of candidates) {
    if (exe && fs.existsSync(exe)) return exe;
  }
  return null;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Boş port bulunamadı.")));
      }
    });
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

class CdpClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || "CDP hatası"));
          } else {
            resolve(msg.result);
          }
        }
      } catch {
        // ignore malformed messages
      }
    });
  }

  static connect(wsUrl: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("Tarayıcı CDP bağlantısı zaman aşımına uğradı."));
      }, 10000);

      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve(new CdpClient(ws));
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Tarayıcı CDP bağlantısı kurulamadı."));
      });
    });
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000);
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

const EXTRACT_FIREBASE_SCRIPT = `(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('firebaseLocalStorageDb');
      req.onsuccess = e => res(e.target.result);
      req.onerror = e => rej((e.target && e.target.error) || new Error('open failed'));
    });
    const storeNames = Array.from(db.objectStoreNames);
    if (!storeNames.includes('firebaseLocalStorage')) {
      db.close();
      return null;
    }
    const entries = await new Promise((res, rej) => {
      const tx = db.transaction('firebaseLocalStorage', 'readonly');
      const s = tx.objectStore('firebaseLocalStorage');
      const req = s.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = e => rej((e.target && e.target.error) || new Error('getAll failed'));
    });
    db.close();
    for (const entry of entries) {
      const key = entry && entry.fbase_key;
      if (typeof key === 'string' && key.startsWith('firebase:authUser:') && key.endsWith(':[DEFAULT]')) {
        const apiKey = key.slice('firebase:authUser:'.length, key.length - ':[DEFAULT]'.length);
        const tokenMgr = entry && entry.value && entry.value.stsTokenManager;
        const refresh = tokenMgr && tokenMgr.refreshToken;
        if (refresh) return { refreshToken: refresh, apiKey };
      }
    }
    return null;
  } catch {
    return null;
  }
})()`;

interface ActiveSsoFlow {
  status: SsoFlowStatus;
  proc: ChildProcess | null;
  port: number | null;
  cancelled: boolean;
}

// Keep singleton across Next.js dev HMR reloads
const globalForSso = globalThis as unknown as {
  __storytelSsoFlow?: ActiveSsoFlow;
};

function getFlow(): ActiveSsoFlow {
  if (!globalForSso.__storytelSsoFlow) {
    globalForSso.__storytelSsoFlow = {
      status: { state: "idle", message: "" },
      proc: null,
      port: null,
      cancelled: false,
    };
  }
  return globalForSso.__storytelSsoFlow;
}

export function getSsoStatus(): SsoFlowStatus {
  return getFlow().status;
}

async function closeBrowserViaCdp(port: number | null): Promise<void> {
  if (!port) return;
  try {
    const targets = await fetchCdpTargets(port);
    const first = targets.find((t) => t.webSocketDebuggerUrl);
    if (first) {
      const cdp = await CdpClient.connect(first.webSocketDebuggerUrl);
      await cdp.send("Browser.close").catch(() => {});
      cdp.close();
    }
  } catch {
    // ignore
  }
}

export function cancelSsoFlow(): void {
  const flow = getFlow();
  flow.cancelled = true;
  const port = flow.port;
  flow.port = null;
  void closeBrowserViaCdp(port);
  if (flow.proc) {
    try {
      flow.proc.kill();
    } catch {
      // ignore
    }
    flow.proc = null;
  }
  flow.status = { state: "cancelled", message: "Giriş iptal edildi." };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCdpTargets(port: number): Promise<any[]> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return [];
    return (await res.json()) as any[];
  } catch {
    return [];
  }
}

export async function startGoogleSsoFlow(): Promise<SsoFlowStatus> {
  const flow = getFlow();

  // If already waiting, return current status
  if (
    flow.proc &&
    !flow.proc.killed &&
    (flow.status.state === "launching" ||
      flow.status.state === "waiting_login" ||
      flow.status.state === "capturing")
  ) {
    return flow.status;
  }

  const browserExe = findBrowserExecutable();
  if (!browserExe) {
    flow.status = {
      state: "error",
      message: "Chrome veya Edge tarayıcısı bulunamadı.",
      error: "Sistemde Google Chrome veya Microsoft Edge kurulu olmalıdır.",
    };
    return flow.status;
  }

  ensureDataDirs();
  const port = await getFreePort();

  flow.cancelled = false;
  flow.status = {
    state: "launching",
    message: "Güvenli giriş penceresi açılıyor...",
  };

  // Launch real Chrome/Edge WITHOUT automation flags so Google OAuth never blocks it.
  console.log(`[SSO] Launching browser: ${browserExe} on CDP port ${port}`);
  const browserArgs = [
    "--new-window",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${SSO_PROFILE_DIR}`,
    "--window-size=540,760",
    "--no-first-run",
    "--no-default-browser-check",
    STORYTEL_LOGIN_URL,
  ];

  const proc = spawn(browserExe, browserArgs, {
    stdio: "ignore",
    detached: false,
    windowsHide: false,
  });

  flow.proc = proc;
  flow.port = port;

  proc.on("exit", () => {
    if (
      flow.status.state === "launching" ||
      flow.status.state === "waiting_login" ||
      flow.status.state === "capturing"
    ) {
      flow.status = {
        state: "cancelled",
        message: "Tarayıcı penceresi kapatıldı.",
      };
    }
    flow.proc = null;
  });

  // Run polling loop in background
  void monitorSsoBrowser(port, proc, flow);

  return flow.status;
}

async function monitorSsoBrowser(
  port: number,
  proc: ChildProcess,
  flow: ActiveSsoFlow,
): Promise<void> {
  try {
    // 1. Wait for CDP endpoint to come up
    let targets: any[] = [];
    for (let i = 0; i < 40; i++) {
      if (flow.cancelled || proc.exitCode !== null) return;
      targets = await fetchCdpTargets(port);
      if (targets.length > 0) break;
      await sleep(300);
    }

    if (targets.length === 0) {
      console.error(`[SSO] CDP port ${port} did not respond in time.`);
      flow.status = {
        state: "error",
        message: "Tarayıcı bağlantı noktası açılamadı.",
        error: "Lütfen açık olan diğer pencereyi kapatıp tekrar deneyin.",
      };
      proc.kill();
      return;
    }

    console.log(`[SSO] CDP ready on port ${port} (${targets.length} targets). Waiting for user login...`);

    // Clear old storytel.com and google.com cookies in the isolated SSO profile
    // so Google always prompts the user to choose/enter their desired Gmail account
    // instead of silently auto-logging in with a previously used account.
    const initialPage = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (initialPage) {
      try {
        const cdp = await CdpClient.connect(initialPage.webSocketDebuggerUrl);
        await cdp.send("Network.enable");
        const { cookies } = await cdp.send("Network.getAllCookies");
        for (const c of cookies ?? []) {
          const domain = String(c.domain || "");
          if (
            domain.includes("storytel.com") ||
            domain.includes("google.com") ||
            domain.includes("googleapis.com")
          ) {
            await cdp
              .send("Network.deleteCookies", {
                name: c.name,
                domain: c.domain,
                path: c.path,
              })
              .catch(() => {});
          }
        }
        await cdp.send("Page.bringToFront").catch(() => {});
        await cdp.send("Page.reload", { ignoreCache: true });
        // Best-effort: automatically click the "Google" sign-in button on Storytel's login page
        void cdp
          .send("Runtime.evaluate", {
            expression: `(async () => {
              for (let i = 0; i < 25; i++) {
                const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                for (const el of btns) {
                  const txt = (el.textContent || '').toLowerCase().trim();
                  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                  if ((txt.includes('google') || aria.includes('google')) && txt.length < 60) {
                    el.click();
                    return true;
                  }
                }
                await new Promise(r => setTimeout(r, 250));
              }
              return false;
            })()`,
            awaitPromise: true,
          })
          .catch(() => {})
          .finally(() => cdp.close());
      } catch {
        // non-fatal
      }
    }

    flow.status = {
      state: "waiting_login",
      message: "Açılan pencerede Google hesabınızla Storytel'e giriş yapın...",
    };

    // 2. Poll until user completes login and lands on a post-login storytel.com page
    const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes
    while (Date.now() < deadline) {
      if (flow.cancelled || proc.exitCode !== null) return;
      await sleep(1000);

      const currentTargets = await fetchCdpTargets(port);
      const storytelTab = currentTargets.find((t) => {
        if (t.type !== "page" || !t.url || !t.webSocketDebuggerUrl) return false;
        try {
          const u = new URL(t.url);
          if (!u.hostname.endsWith("storytel.com")) return false;
          if (FIREBASE_AUTH_PATH.test(u.pathname)) return false;
          if (LOGIN_PATH.test(u.pathname)) return false;
          return true;
        } catch {
          return false;
        }
      });

      if (!storytelTab) continue;

      // Verify storytel_session cookie exists
      let cdp: CdpClient | null = null;
      try {
        cdp = await CdpClient.connect(storytelTab.webSocketDebuggerUrl);
        const { cookies } = await cdp.send("Network.getAllCookies");
        const sessionCookie = (cookies ?? []).find(
          (c: any) =>
            c.name === "storytel_session" &&
            String(c.domain || "").includes("storytel.com") &&
            c.value,
        );

        if (!sessionCookie) {
          cdp.close();
          continue;
        }

        flow.status = {
          state: "capturing",
          message: "Giriş algılandı, oturum güvenli şekilde şifreleniyor...",
        };
        console.log("[SSO] storytel_session cookie detected! Extracting Firebase refresh token...");

        // Ensure we are on www.storytel.com to read Firebase IndexedDB
        const currentHost = new URL(storytelTab.url).hostname;
        if (currentHost !== "www.storytel.com") {
          await cdp.send("Page.navigate", { url: STORYTEL_STORAGE_TARGET });
          await sleep(2000);
        } else {
          await sleep(1200);
        }

        let fb: { refreshToken: string; apiKey: string } | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const evalRes = await cdp.send("Runtime.evaluate", {
            expression: EXTRACT_FIREBASE_SCRIPT,
            awaitPromise: true,
            returnByValue: true,
          });
          const val = evalRes?.result?.value;
          if (val?.refreshToken && val?.apiKey) {
            fb = val;
            break;
          }
          await sleep(1000);
        }

        if (!fb) {
          cdp.close();
          flow.status = {
            state: "error",
            message: "Firebase oturum anahtarı okunamadı.",
            error: "Lütfen giriş işlemini tekrar deneyin.",
          };
          proc.kill();
          return;
        }

        const claims = decodeJwtPayload(sessionCookie.value);
        const email = typeof claims?.email === "string" ? claims.email : "";
        const cid = typeof claims?.cid === "string" ? claims.cid : "";

        const stored: StoredSession = saveSsoSession({
          storytelSession: sessionCookie.value,
          firebaseRefreshToken: fb.refreshToken,
          firebaseApiKey: fb.apiKey,
          email,
          cid,
        });

        try {
          await cdp.send("Browser.close");
        } catch {
          proc.kill();
        }
        cdp.close();

        flow.status = {
          state: "success",
          message: "Giriş başarılı!",
          email: stored.email,
          sid: stored.sid,
        };
        console.log(`[SSO] Login succeeded! Encrypted session saved.`);
        flow.proc = null;
        return;
      } catch {
        cdp?.close();
      }
    }

    flow.status = {
      state: "error",
      message: "Giriş zaman aşımına uğradı (5 dakika).",
      error: "Lütfen tekrar deneyin.",
    };
    proc.kill();
  } catch (err: any) {
    flow.status = {
      state: "error",
      message: "Google girişi sırasında hata oluştu.",
      error: err?.message || "Bilinmeyen hata",
    };
    try {
      proc.kill();
    } catch {
      // ignore
    }
  }
}
