const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

let mainWindow = null;
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startNextServer();
      createMainWindow();
    } catch (err) {
      console.error("[Electron] Failed to start:", err);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      createMainWindow();
    }
  });

  app.on("before-quit", () => {
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch {}
      serverProcess = null;
    }
  });
}
