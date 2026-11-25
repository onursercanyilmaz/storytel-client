import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-features-test-"));
process.env.STORYTEL_DATA_DIR = tempDir;

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("SRS SM-2 scheduler computes intervals and due status accurately", async () => {
  const { computeNextSrs, isDueForReview } = await import("../src/lib/srs");
  const now = new Date("2026-11-25T12:00:00Z");

  // First Good review -> 1 day interval
  const r1 = computeNextSrs({}, 3, now);
  assert.equal(r1.srsInterval, 1);
  assert.equal(r1.srsReps, 1);
  assert.equal(r1.mastered, false);

  // Second Good review -> 6 day interval
  const r2 = computeNextSrs(r1, 3, now);
  assert.equal(r2.srsInterval, 6);
  assert.equal(r2.srsReps, 2);

  // Third Good review -> >= 12 day interval & mastered = true
  const r3 = computeNextSrs(r2, 3, now);
  assert.ok(r3.srsInterval >= 12);
  assert.equal(r3.mastered, true);

  // Again (quality 0) resets reps to 0 and interval to 1
  const reset = computeNextSrs(r3, 0, now);
  assert.equal(reset.srsReps, 0);
  assert.equal(reset.srsInterval, 1);
  assert.equal(reset.mastered, false);

  assert.equal(
    isDueForReview(
      {
        id: "1",
        word: "test",
        meaning: "deneme",
        mastered: false,
        createdAt: now.toISOString(),
        nextReviewAt: new Date(now.getTime() - 1000).toISOString(),
      },
      now,
    ),
    true,
  );
  assert.equal(
    isDueForReview(
      {
        id: "2",
        word: "future",
        meaning: "gelecek",
        mastered: false,
        createdAt: now.toISOString(),
        nextReviewAt: new Date(now.getTime() + 86400_000).toISOString(),
      },
      now,
    ),
    false,
  );
});

test("Streaks & Badges calculate consecutive days and badge unlocks", async () => {
  const { computeStreaksAndBadges } = await import("../src/lib/srs");
  const now = new Date("2026-11-25T12:00:00Z");

  const stats = {
    totalSeconds: 36000, // 10 hours
    dailyGoalMinutes: 25,
    yearlyBookGoal: 12,
    dailySeconds: {
      "2026-11-23": 1200,
      "2026-11-24": 1800,
      "2026-11-25": 900,
    },
    recentBooks: [],
  };

  const res = computeStreaksAndBadges(stats, 12, now);
  assert.equal(res.currentStreakDays, 3);
  assert.equal(res.longestStreakDays, 3);
  assert.equal(res.dailyGoalMinutes, 25);
  assert.equal(res.badges.find((b) => b.id === "streak-3")?.unlocked, true);
  assert.equal(res.badges.find((b) => b.id === "hours-10")?.unlocked, true);
  assert.equal(res.badges.find((b) => b.id === "vocab-10")?.unlocked, true);
  assert.equal(res.badges.find((b) => b.id === "streak-7")?.unlocked, false);
});

test("Highlights CRUD supports per-book filtering and per-profile isolation", async () => {
  const { addHighlight, getHighlights, deleteHighlight } = await import("../src/lib/local-store");
  const { switchActiveProfile } = await import("../src/lib/profiles");

  switchActiveProfile("p-main");
  const h1 = addHighlight({
    bookId: "b-1",
    bookTitle: "Dune",
    chapterIndex: 0,
    text: "Fear is the mind-killer.",
    note: "Litany against fear",
    color: "yellow",
  });
  const h2 = addHighlight({
    bookId: "b-2",
    bookTitle: "1984",
    chapterIndex: 2,
    text: "Big Brother is watching you.",
    color: "pink",
  });

  assert.equal(getHighlights("b-1").length, 1);
  assert.equal(getHighlights().length, 2);

  // Kid profile must have 0 highlights
  switchActiveProfile("p-kid");
  assert.equal(getHighlights().length, 0);

  switchActiveProfile("p-main");
  assert.equal(deleteHighlight(h1.id), true);
  assert.equal(deleteHighlight(h2.id), true);
  assert.equal(getHighlights().length, 0);
});

test("Parental PIN protects switching out of Kid profile and strips pinHash", async () => {
  const {
    updateProfile,
    switchActiveProfile,
    isPinRequiredForSwitch,
    sanitizeProfile,
    getActiveProfile,
  } = await import("../src/lib/profiles");

  // Set PIN on Main profile
  const upd = updateProfile("p-main", { pin: "1234" });
  assert.ok(upd.profile?.pinHash);
  const safe = sanitizeProfile(upd.profile!);
  assert.equal(safe.hasPin, true);
  assert.equal("pinHash" in safe, false);

  // Switch to Kid profile (allowed without PIN)
  const kid = switchActiveProfile("p-kid");
  assert.equal(kid?.id, "p-kid");
  assert.equal(isPinRequiredForSwitch("p-main"), true);

  // Attempt to switch back to Main without PIN -> blocked (null)
  assert.equal(switchActiveProfile("p-main"), null);
  assert.equal(getActiveProfile().id, "p-kid");

  // Wrong PIN -> blocked
  assert.equal(switchActiveProfile("p-main", "9999"), null);

  // Correct PIN -> succeeds
  const main = switchActiveProfile("p-main", "1234");
  assert.equal(main?.id, "p-main");

  // Clear PIN cleanly
  updateProfile("p-main", { pin: "" });
  assert.equal(sanitizeProfile(getActiveProfile()).hasPin, false);
});

test("Local M4B/MP3 audiobook library saves, lists, finds, and deletes safely", async () => {
  const {
    saveLocalAudiobookBuffer,
    listLocalAudiobooks,
    findLocalAudiobook,
    deleteLocalAudiobook,
  } = await import("../src/lib/local-audiobooks");

  const entry = saveLocalAudiobookBuffer({
    fileName: "sample-book.m4b",
    title: "My Local M4B",
    authors: "Test Author",
    buffer: Buffer.from("ID3-FAKE-AUDIO-DATA"),
  });

  assert.ok(entry.id.startsWith("local-"));
  assert.equal(entry.format, "m4b");
  assert.equal(listLocalAudiobooks().length, 1);
  assert.equal(findLocalAudiobook(entry.id)?.title, "My Local M4B");
  assert.equal(deleteLocalAudiobook(entry.id), true);
  assert.equal(listLocalAudiobooks().length, 0);
});
