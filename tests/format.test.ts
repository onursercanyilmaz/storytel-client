import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBytes,
  formatDurationMs,
  formatTime,
  getLanguageLabel,
} from "../src/lib/format";

test("formatTime formats seconds into mm:ss and h:mm:ss", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(-5), "0:00");
  assert.equal(formatTime(65), "1:05");
  assert.equal(formatTime(3661), "1:01:01");
});

test("formatDurationMs formats Turkish hour/minute durations", () => {
  assert.equal(formatDurationMs(0), "");
  assert.equal(formatDurationMs(45 * 60 * 1000), "45 dk");
  assert.equal(formatDurationMs(2 * 3600 * 1000), "2 sa");
  assert.equal(formatDurationMs((2 * 60 + 15) * 60 * 1000), "2 sa 15 dk");
});

test("formatBytes formats KB, MB, GB", () => {
  assert.equal(formatBytes(0), "0 MB");
  assert.equal(formatBytes(512 * 1024), "512 KB");
  assert.equal(formatBytes(15 * 1024 * 1024), "15.0 MB");
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), "1.50 GB");
});

test("getLanguageLabel returns localized Turkish labels", () => {
  assert.equal(getLanguageLabel("tr"), "Türkçe");
  assert.equal(getLanguageLabel("EN"), "İngilizce");
  assert.equal(getLanguageLabel("xx", "Özel Dil"), "Özel Dil");
  assert.equal(getLanguageLabel("", ""), "Diğer");
});
