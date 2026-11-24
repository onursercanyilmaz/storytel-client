import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-dl-test-"));
process.env.STORYTEL_DATA_DIR = tempDir;

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("isValidBookId blocks path traversal and non-numeric IDs", async () => {
  const { isValidBookId } = await import("../src/lib/downloads");
  assert.equal(isValidBookId("123456"), true);
  assert.equal(isValidBookId("../etc/passwd"), false);
  assert.equal(isValidBookId("123/456"), false);
  assert.equal(isValidBookId("abc"), false);
  assert.equal(isValidBookId(""), false);
});

test("listDownloads, findDownloadedFile and cancelOrDeleteDownload manage local MP3s", async () => {
  const {
    findDownloadedFile,
    listDownloads,
    getDownloadStatus,
    cancelOrDeleteDownload,
  } = await import("../src/lib/downloads");
  const { DOWNLOADS_DIR, ensureDataDirs } = await import("../src/lib/paths");

  ensureDataDirs();
  const sampleFile = path.join(DOWNLOADS_DIR, "Dune [998877].mp3");
  fs.writeFileSync(sampleFile, Buffer.alloc(4096, 1));

  assert.equal(findDownloadedFile("998877"), sampleFile);
  const status = getDownloadStatus("998877");
  assert.equal(status.downloaded, true);
  assert.equal(status.bytes, 4096);

  const list = listDownloads();
  assert.equal(list.files.length, 1);
  assert.equal(list.files[0].bookId, "998877");
  assert.equal(list.files[0].title, "Dune");
  assert.equal(list.totalBytes, 4096);

  assert.equal(cancelOrDeleteDownload("998877"), true);
  assert.equal(findDownloadedFile("998877"), null);
});
