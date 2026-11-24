import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { parseEpubBuffer } from "../src/lib/epub-parser";

/** Builds a minimal valid ZIP archive in memory (stored + deflate). */
function buildZip(files: Record<string, string>, compress = true): Buffer {
  const localParts: Buffer[] = [];
  const cdParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, "utf8");
    const rawBuf = Buffer.from(content, "utf8");
    const dataBuf = compress ? zlib.deflateRawSync(rawBuf) : rawBuf;
    const method = compress ? 8 : 0;

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(rawBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(dataBuf.length, 20);
    cd.writeUInt32LE(rawBuf.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);

    localParts.push(local, dataBuf);
    cdParts.push(cd);
    offset += local.length + dataBuf.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, cdBuf, eocd]);
}

test("parseEpubBuffer extracts Turkish chapters and strips XSS scripts", () => {
  const epub = buildZip({
    "META-INF/container.xml": `<?xml version="1.0"?>
      <container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
    "OEBPS/content.opf": `<package>
      <metadata><dc:title>Şeker Portakalı</dc:title></metadata>
      <manifest>
        <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
        <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine><itemref idref="ch1"/><itemref idref="ch2"/></spine>
    </package>`,
    "OEBPS/ch1.xhtml": `<html><body><h1>Bölüm 1: Ağaç</h1><p onclick="alert(1)">Merhaba dünya!</p><script>evil()</script></body></html>`,
    "OEBPS/ch2.xhtml": `<html><body><h2>Bölüm 2: İkinci Kısım</h2><p>Güneş doğarken yürüdüler.</p></body></html>`,
  });

  const parsed = parseEpubBuffer(epub);
  assert.equal(parsed.drmProtected, undefined);
  assert.equal(parsed.title, "Şeker Portakalı");
  assert.equal(parsed.chapters.length, 2);
  assert.equal(parsed.chapters[0].title, "Bölüm 1: Ağaç");
  assert.equal(parsed.chapters[0].html.includes("<script>"), false);
  assert.equal(parsed.chapters[0].html.includes("onclick"), false);
  assert.ok(parsed.chapters[0].html.includes("Merhaba dünya!"));
  assert.equal(parsed.chapters[1].title, "Bölüm 2: İkinci Kısım");
  assert.ok(parsed.totalChars > 20);
});

test("parseEpubBuffer detects DRM-encrypted EPUB archives", () => {
  const drmEpub = buildZip({
    "META-INF/encryption.xml": `<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/></EncryptedData></encryption>`,
    "META-INF/container.xml": `<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`,
  });

  const parsed = parseEpubBuffer(drmEpub);
  assert.equal(parsed.drmProtected, true);
  assert.equal(parsed.chapters.length, 0);
});
