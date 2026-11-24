const path = require("path");
const fs = require("fs");

process.env.PORT = process.env.PORT || "3000";
process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";

const standaloneServer = path.join(__dirname, "..", ".next", "standalone", "server.js");

if (fs.existsSync(standaloneServer)) {
  console.log(`> storytel-client running on http://${process.env.HOSTNAME}:${process.env.PORT}`);
  require(standaloneServer);
} else {
  const { spawn } = require("child_process");
  const nextBin = path.join(
    __dirname,
    "..",
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next",
  );
  spawn(nextBin, ["start", "-H", process.env.HOSTNAME, "-p", process.env.PORT], {
    stdio: "inherit",
    shell: true,
  });
}
