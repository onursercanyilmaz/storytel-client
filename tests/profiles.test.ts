import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getProfilesStore,
  getActiveProfile,
  switchActiveProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  MAX_PROFILES,
} from "../src/lib/profiles";
import {
  getLibraryMeta,
  toggleFavorite,
  saveProfilePosition,
  getProfilePosition,
  addVocabEntry,
  getVocabulary,
} from "../src/lib/local-store";

test("Profiles: Initializes with 1 Main and 1 Kid profile by default", () => {
  const store = getProfilesStore();
  assert.ok(store.profiles.length >= 2);
  const main = store.profiles.find((p) => p.isMain);
  const kid = store.profiles.find((p) => p.isKid);
  assert.ok(main, "Ana hesap profili mevcut olmalı");
  assert.ok(kid, "Çocuk profili mevcut olmalı");
  assert.equal(main.isMain, true);
  assert.equal(kid.isKid, true);
});

test("Profiles: Enforces maximum 5 profiles constraint", () => {
  while (getProfilesStore().profiles.length < MAX_PROFILES) {
    const count = getProfilesStore().profiles.length;
    const res = createProfile({ name: `Alt Hesap ${count + 1}` });
    assert.ok(res.profile);
  }

  assert.equal(getProfilesStore().profiles.length, MAX_PROFILES);

  // 6th profile must fail
  const p6 = createProfile({ name: "Fazla Profil" });
  assert.ok(p6.error);
  assert.match(p6.error, /en fazla 5/i);
});

test("Profiles: Switch active profile works seamlessly", () => {
  const switched = switchActiveProfile("p-kid");
  assert.ok(switched);
  assert.equal(switched?.id, "p-kid");
  assert.equal(getActiveProfile().id, "p-kid");
  assert.equal(getActiveProfile().isKid, true);

  // Switch back to main
  switchActiveProfile("p-main");
  assert.equal(getActiveProfile().id, "p-main");
});

test("Profiles: Update profile modifies details and preserves constraints", () => {
  const updated = updateProfile("p-kid", { name: "Can (Çocuk)", avatar: "🦁" });
  assert.ok(updated.profile);
  assert.equal(updated.profile?.name, "Can (Çocuk)");
  assert.equal(updated.profile?.avatar, "🦁");

  // Attempting to make Main profile a Kid profile should be ignored
  const mainAttempt = updateProfile("p-main", { isKid: true });
  assert.equal(mainAttempt.profile?.isKid, false);
});

test("Profiles: Main profile cannot be deleted, sub-profiles can", () => {
  const delMain = deleteProfile("p-main");
  assert.equal(delMain.success, false);
  assert.match(delMain.error || "", /ana hesap/i);

  // Delete an extra profile
  const store = getProfilesStore();
  const extra = store.profiles.find((p) => !p.isMain && p.id !== "p-kid");
  if (extra) {
    const delExtra = deleteProfile(extra.id);
    assert.equal(delExtra.success, true);
  }
});

test("Profiles: Complete Data Isolation across profiles (Favorites, Position, Vocab)", () => {
  const bookMain = `book-main-${Date.now()}`;
  const bookKid = `book-kid-${Date.now()}`;
  const wordMain = `WordMain${Date.now()}`;

  // Main profile adds favorite book
  switchActiveProfile("p-main");
  toggleFavorite(bookMain);
  saveProfilePosition(bookMain, 350000, 1000000); // 350s
  addVocabEntry({ word: wordMain, meaning: "Mutlu tesadüf" });

  const mainMeta = getLibraryMeta();
  assert.ok(mainMeta.favorites.includes(bookMain));
  assert.equal(getProfilePosition(bookMain)?.positionMs, 350000);
  assert.ok(getVocabulary().some((v) => v.word === wordMain));

  // Switch to Kid profile
  switchActiveProfile("p-kid");
  const kidMeta = getLibraryMeta();
  // Kid must NOT have bookMain in favorites
  assert.equal(kidMeta.favorites.includes(bookMain), false);
  // Kid must NOT have position for bookMain
  assert.equal(getProfilePosition(bookMain), null);
  // Kid vocab must NOT have wordMain
  assert.equal(getVocabulary().some((v) => v.word === wordMain), false);

  // Kid adds their own favorite and position 120s
  toggleFavorite(bookKid);
  saveProfilePosition(bookKid, 120000, 500000);
  assert.ok(getLibraryMeta().favorites.includes(bookKid));
  assert.equal(getProfilePosition(bookKid)?.positionMs, 120000);

  // Switch back to Main profile: must still have bookMain, but NOT bookKid
  switchActiveProfile("p-main");
  assert.ok(getLibraryMeta().favorites.includes(bookMain));
  assert.equal(getLibraryMeta().favorites.includes(bookKid), false);
  assert.equal(getProfilePosition(bookMain)?.positionMs, 350000);
  assert.equal(getProfilePosition(bookKid), null);
});
