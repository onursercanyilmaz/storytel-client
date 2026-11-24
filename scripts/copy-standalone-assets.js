const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

if (fs.existsSync(standaloneDir)) {
  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standaloneDir, "public");
  copyDir(publicSrc, publicDest);

  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  copyDir(staticSrc, staticDest);

  console.log("✓ Copied public/ and .next/static/ into .next/standalone/");
}
