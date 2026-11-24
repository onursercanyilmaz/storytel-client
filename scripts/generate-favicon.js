const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pngPath = path.join(root, "public", "icon.png");

if (!fs.existsSync(pngPath)) {
  console.error("icon.png not found");
  process.exit(1);
}

const pngBuffer = fs.readFileSync(pngPath);

// Create valid ICO file embedding the PNG
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // ICO type = 1
header.writeUInt16LE(1, 4); // 1 image

const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(0, 0); // 0 means 256+ width
dirEntry.writeUInt8(0, 1); // 0 means 256+ height
dirEntry.writeUInt8(0, 2); // Color palette
dirEntry.writeUInt8(0, 3); // Reserved
dirEntry.writeUInt16LE(1, 4); // Color planes
dirEntry.writeUInt16LE(32, 6); // Bits per pixel
dirEntry.writeUInt32LE(pngBuffer.length, 8); // Image size in bytes
dirEntry.writeUInt32LE(22, 12); // Image data offset (6 + 16 = 22)

const icoBuffer = Buffer.concat([header, dirEntry, pngBuffer]);

// Write to public/favicon.ico
fs.writeFileSync(path.join(root, "public", "favicon.ico"), icoBuffer);
// Write to src/app/favicon.ico for Next.js App Router root icon
fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), icoBuffer);

console.log("✓ Generated public/favicon.ico and src/app/favicon.ico successfully! Size:", icoBuffer.length);
