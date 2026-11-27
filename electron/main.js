const { app, BrowserWindow, Menu, Tray, dialog, nativeImage, shell } = require("electron");
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let serverProcess = null;
const PORT = 38421;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode) return resolve(true);
          retry();
        })
        .on("error", () => {
          retry();
        });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("Next.js internal server failed to become ready"));
      }
      setTimeout(check, 250);
    };

    check();
  });
}

function findServerScript() {
  const candidates = [
    path.join(process.resourcesPath || "", "standalone", "server.js"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", ".next", "standalone", "server.js"),
    path.join(process.resourcesPath || "", "app", ".next", "standalone", "server.js"),
    path.join(process.resourcesPath || "", ".next", "standalone", "server.js"),
    path.join(__dirname, "..", ".next", "standalone", "server.js"),
    path.join(app.getAppPath(), ".next", "standalone", "server.js"),
  ];

  for (const p of candidates) {
    try {
      if (require("fs").existsSync(p)) return p;
    } catch {}
  }
  return candidates[0];
}

async function startNextServer() {
  const serverPath = findServerScript();
  const userDataDir = path.join(app.getPath("userData"), "storytel-data");
  console.log("[Electron] Starting Next.js standalone server in-process:", serverPath);
  console.log("[Electron] Using STORYTEL_DATA_DIR:", userDataDir);

  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.NODE_ENV = "production";
  if (!process.env.STORYTEL_DATA_DIR) {
    process.env.STORYTEL_DATA_DIR = userDataDir;
  }

  require(serverPath);

  await waitForServer(`${SERVER_URL}/api/auth/me`);
  console.log("[Electron] Server ready on", SERVER_URL);
}

function createMainWindow() {
  const iconPath = path.join(__dirname, "..", "public", "icon.png");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Storytel Client",
    backgroundColor: "#08080a",
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadURL(SERVER_URL);

  // Open external links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getAppIconPath() {
  const candidates = [
    path.join(process.resourcesPath || "", "standalone", "public", "icon.png"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", ".next", "standalone", "public", "icon.png"),
    path.join(__dirname, "..", "public", "icon.png"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return candidates[1];
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(getAppIconPath()).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip("Storytel Client");
    const menu = Menu.buildFromTemplate([
      {
        label: "Storytel Client'ı Göster",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createMainWindow();
          }
        },
      },
      { type: "separator" },
      {
        label: "Çıkış",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) mainWindow.focus();
        else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn("[Electron] Tray init skipped:", err?.message || err);
  }
}

function checkForUpdates() {
  try {
    const req = https.get(
      "https://api.github.com/repos/onursercanyilmaz/storytel-client/releases/latest",
      { headers: { "User-Agent": "storytel-client-desktop" }, timeout: 8000 },
      (res) => {
        if (res.statusCode !== 200) return;
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            const rel = JSON.parse(raw);
            const latestTag = String(rel.tag_name || "").replace(/^v/, "");
            const current = app.getVersion();
            if (latestTag && latestTag !== current && latestTag > current) {
              dialog
                .showMessageBox(mainWindow, {
                  type: "info",
                  title: "Güncelleme Mevcut",
                  message: `Storytel Client v${latestTag} yayınlandı (Mevcut: v${current}).`,
                  buttons: ["İndirme Sayfasını Aç", "Daha Sonra"],
                  defaultId: 0,
                })
                .then(({ response }) => {
                  if (response === 0) {
                    shell.openExternal("https://github.com/onursercanyilmaz/storytel-client/releases/latest");
                  }
                });
            }
          } catch {}
        });
      },
    );
    req.on("error", () => {});
  } catch {}
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startNextServer();
      createMainWindow();
      createTray();
      setTimeout(checkForUpdates, 5000);
    } catch (err) {
      console.error("[Electron] Failed to start:", err);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && (isQuitting || !tray)) {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      createMainWindow();
    } else {
      mainWindow.show();
    }
  });

  app.on("before-quit", () => {
    isQuitting = true;
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch {}
      serverProcess = null;
    }
  });
}
