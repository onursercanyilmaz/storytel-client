import path from "path";
import zlib from "zlib";

export interface EbookChapter {
  index: number;
  title: string;
  html: string;
  charCount: number;
}

export interface ParsedEbook {
  title: string;
  chapters: EbookChapter[];
  totalChars: number;
  drmProtected?: boolean;
  fileBytes?: number;
}

/**
 * Minimal, zero-dependency ZIP reader for EPUB archives using Node's native zlib.
 * Reads End-of-Central-Directory + Central Directory entries safely.
 */
function unzipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();

  // Locate End of Central Directory signature (0x06054b50)
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Geçersiz EPUB/ZIP arşivi.");
  }

  const cdEntries = buf.readUInt16LE(eocdOffset + 10);
  let cdOffset = buf.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < cdEntries; i++) {
    if (cdOffset + 46 > buf.length) break;
    if (buf.readUInt32LE(cdOffset) !== 0x02014b50) break;

    const method = buf.readUInt16LE(cdOffset + 10);
    const compressedSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buf.readUInt32LE(cdOffset + 42);

    const fileName = buf
      .subarray(cdOffset + 46, cdOffset + 46 + nameLen)
      .toString("utf8")
      .replace(/\\/g, "/");

    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (fileName.endsWith("/")) continue;
    if (localHeaderOffset + 30 > buf.length) continue;

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) continue;

    const rawSlice = buf.subarray(dataStart, dataEnd);
    try {
      if (method === 0) {
        entries.set(fileName, Buffer.from(rawSlice));
      } else if (method === 8) {
        entries.set(fileName, zlib.inflateRawSync(rawSlice));
      }
    } catch {
      // skip corrupted entry
    }
  }

  return entries;
}

function sanitizeChapterHtml(rawHtml: string): string {
  // Extract <body> inner content if present
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let html = bodyMatch ? bodyMatch[1] : rawHtml;

  // Strip dangerous tags and inline event handlers
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  return html.trim();
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstHeading(html: string, fallback: string): string {
  const match = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (match) {
    const text = stripHtmlTags(match[1]);
    if (text && text.length <= 120) return text;
  }
  return fallback;
}

export function parseEpubBuffer(buf: Buffer): ParsedEbook {
  const files = unzipEntries(buf);

  // Detect Adobe / LCP / FairPlay DRM encryption
  const encXml = files.get("META-INF/encryption.xml")?.toString("utf8") || "";
  if (
    encXml &&
    /EncryptedData/i.test(encXml) &&
    !/http:\/\/www\.idpf\.org\/2008\/embedding/i.test(encXml)
  ) {
    return {
      title: "",
      chapters: [],
      totalChars: 0,
      drmProtected: true,
    };
  }

  // Locate OPF path from META-INF/container.xml
  const containerXml =
    files.get("META-INF/container.xml")?.toString("utf8") || "";
  const rootMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
  const opfPath = rootMatch?.[1] ||
    Array.from(files.keys()).find((k) => k.endsWith(".opf")) || "";

  if (!opfPath || !files.has(opfPath)) {
    throw new Error("EPUB içerik haritası (OPF) bulunamadı.");
  }

  const opfDir = path.posix.dirname(opfPath);
  const opfXml = files.get(opfPath)!.toString("utf8");

  // Book title
  const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const bookTitle = titleMatch ? stripHtmlTags(titleMatch[1]) : "";

  // Parse <manifest> items: id -> href
  const manifest = new Map<string, string>();
  const itemRegex = /<item\s+([^>]+?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(opfXml)) !== null) {
    const attrs = m[1];
    const id = attrs.match(/id=["']([^"']+)["']/i)?.[1];
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
    if (id && href) {
      manifest.set(id, decodeURIComponent(href));
    }
  }

  // Parse <spine> itemrefs
  const spineIds: string[] = [];
  const itemrefRegex = /<itemref\s+([^>]+?)\/?>/gi;
  while ((m = itemrefRegex.exec(opfXml)) !== null) {
    const idref = m[1].match(/idref=["']([^"']+)["']/i)?.[1];
    if (idref) spineIds.push(idref);
  }

  const chapters: EbookChapter[] = [];
  let totalChars = 0;

  for (const idref of spineIds) {
    const href = manifest.get(idref);
    if (!href) continue;
    const resolved =
      opfDir && opfDir !== "." ? path.posix.join(opfDir, href) : href;
    const rawBuf = files.get(resolved) ?? files.get(href);
    if (!rawBuf) continue;

    const cleanHtml = sanitizeChapterHtml(rawBuf.toString("utf8"));
    const plain = stripHtmlTags(cleanHtml);
    if (plain.length < 5) continue;

    const idx = chapters.length;
    const title = extractFirstHeading(cleanHtml, `Bölüm ${idx + 1}`);
    totalChars += plain.length;
    chapters.push({
      index: idx,
      title,
      html: cleanHtml,
      charCount: plain.length,
    });
  }

  return {
    title: bookTitle,
    chapters,
    totalChars,
    fileBytes: buf.length,
  };
}
