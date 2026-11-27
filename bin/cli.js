#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const args = process.argv.slice(2);
let port = process.env.PORT || "3000";
let shouldOpen = true;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
    port = String(parseInt(args[i + 1], 10) || 3000);
    i++;
  } else if (args[i] === "--no-open") {
    shouldOpen = false;
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
storytel-client — Security-first local web & PWA desktop client for Storytel

Usage:
  storytel-client [options]

Options:
  -p, --port <port>   Port to listen on (default: 3000)
  --no-open           Do not automatically open the browser
  -h, --help          Show this help message
`);
    process.exit(0);
  }
}

const dataDir =
  process.env.STORYTEL_DATA_DIR || path.join(os.homedir(), ".storytel-client");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

process.env.STORYTEL_DATA_DIR = dataDir;
process.env.PORT = port;
process.env.HOSTNAME = "127.0.0.1";
process.env.NODE_ENV = "production";

const pkgRoot = path.join(__dirname, "..");
const standaloneServer = path.join(pkgRoot, ".next", "standalone", "server.js");

if (!fs.existsSync(standaloneServer)) {
  console.error(
    "[storytel-client] Standalone build not found. Run 'npm run build' first.",
  );
  process.exit(1);
}

const url = `http://127.0.0.1:${port}`;
console.log(`> storytel-client starting on ${url}`);
console.log(`> Data directory: ${dataDir}`);

require(standaloneServer);

if (shouldOpen) {
  const start = Date.now();
  const poll = () => {
    http
      .get(`${url}/api/auth/me`, (res) => {
        if (res.statusCode) {
          openBrowser(url);
          return;
        }
        if (Date.now() - start < 15000) setTimeout(poll, 300);
      })
      .on("error", () => {
        if (Date.now() - start < 15000) setTimeout(poll, 300);
      });
  };
  setTimeout(poll, 400);
}

function openBrowser(targetUrl) {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", targetUrl], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [targetUrl], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }
  } catch {
    // ignore browser launch errors
  }
}
