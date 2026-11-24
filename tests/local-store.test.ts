import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "st-store-test-"));
process.env.STORYTEL_DATA_DIR = tempDir;

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("favorites toggle adds and removes book IDs cleanly", async () => {
  const { toggleFavorite, getLibraryMeta } = await import(
    "../src/lib/local-store"
  );

  const first = toggleFavorite("1001");
  assert.equal(first.isFavorite, true);
  assert.deepEqual(getLibraryMeta().favorites, ["1001"]);

  const second = toggleFavorite("1001");
  assert.equal(second.isFavorite, false);
  assert.deepEqual(getLibraryMeta().favorites, []);
});

test("custom collections support CRUD and book membership toggling", async () => {
  const { createCollection, updateCollection, deleteCollection, getLibraryMeta } =
    await import("../src/lib/local-store");

  const col = createCollection("Bilim Kurgu", "#3b82f6");
  assert.equal(col.name, "Bilim Kurgu");
  assert.equal(col.color, "#3b82f6");
  assert.deepEqual(col.bookIds, []);

  // Toggle book in
  const added = updateCollection(col.id, { toggleBookId: "555" });
  assert.deepEqual(added?.bookIds, ["555"]);

  // Rename and toggle book out
  const updated = updateCollection(col.id, {
    name: "Favori Bilim Kurgu",
    toggleBookId: "555",
  });
  assert.equal(updated?.name, "Favori Bilim Kurgu");
  assert.deepEqual(updated?.bookIds, []);

  // Delete
  assert.equal(deleteCollection(col.id), true);
  assert.equal(
    getLibraryMeta().collections.some((c) => c.id === col.id),
    false,
  );
});

test("listening stats accumulate daily seconds and deduplicate recent books", async () => {
  const { recordListeningProgress, getListeningStats } = await import(
    "../src/lib/local-store"
  );

  recordListeningProgress({
    seconds: 30,
    book: {
      id: "101",
      title: "Dune",
      authors: "Frank Herbert",
      coverUrl: "https://covers.storytel.com/101.jpg",
      positionMs: 30000,
      durationMs: 3600000,
    },
  });

  recordListeningProgress({
    seconds: 45,
    book: {
      id: "101",
      title: "Dune",
      authors: "Frank Herbert",
      coverUrl: "https://covers.storytel.com/101.jpg",
      positionMs: 75000,
      durationMs: 3600000,
    },
  });

  const stats = getListeningStats();
  assert.equal(stats.totalSeconds, 75);
  assert.equal(stats.recentBooks.length, 1);
  assert.equal(stats.recentBooks[0].positionMs, 75000);
});

test("vocabulary builder supports add, deduplication, mastered toggle, and delete", async () => {
  const { addVocabEntry, updateVocabEntry, deleteVocabEntry, getVocabulary } =
    await import("../src/lib/local-store");

  const entry = addVocabEntry({
    word: "serendipity",
    meaning: "şans eseri güzel bir şey bulma",
    bookTitle: "1984",
  });
  assert.equal(entry.word, "serendipity");
  assert.equal(entry.mastered, false);

  // Adding same word (case-insensitive) updates rather than duplicating
  addVocabEntry({ word: "Serendipity", meaning: "tesadüfi şans" });
  assert.equal(getVocabulary().length, 1);
  assert.equal(getVocabulary()[0].meaning, "tesadüfi şans");

  const mastered = updateVocabEntry(entry.id, { mastered: true });
  assert.equal(mastered?.mastered, true);

  assert.equal(deleteVocabEntry(entry.id), true);
  assert.equal(getVocabulary().length, 0);

  // Book-specific entries
  addVocabEntry({
    word: "dystopia",
    meaning: "baskıcı toplum",
    bookId: "book-1984",
    bookTitle: "1984",
  });
  addVocabEntry({
    word: "epiphany",
    meaning: "ani aydınlanma",
    bookId: "book-dubliners",
    bookTitle: "Dubliners",
  });

  const allWords = getVocabulary();
  assert.equal(allWords.length, 2);
  const book1984Words = allWords.filter((w) => w.bookId === "book-1984");
  assert.equal(book1984Words.length, 1);
  assert.equal(book1984Words[0].word, "dystopia");

  deleteVocabEntry(allWords[0].id);
  deleteVocabEntry(allWords[1].id);
});
