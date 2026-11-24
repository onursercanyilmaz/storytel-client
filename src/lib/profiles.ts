import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, ensureDataDirs } from "./paths";

export interface ProfilePreferences {
  theme?: "dark" | "light";
  lang?: "tr" | "en";
  playbackSpeed?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string; // Emoji avatar: 👤, 👦, 👧, 🦊, 🦁, 🦉, 🚀, 🎧, 📚, ✨
  color: string; // Hex color accent
  isMain: boolean; // Exactly 1 main profile (owner)
  isKid: boolean; // Kids mode with safe content filtering
  createdAt: string;
  preferences?: ProfilePreferences;
}

export interface ProfilesStoreData {
  activeProfileId: string;
  profiles: UserProfile[];
}

export const MAX_PROFILES = 5;

const PROFILES_PATH = path.join(DATA_DIR, "profiles.json");
const PROFILES_DIR = path.join(DATA_DIR, "profiles");

export const PRESET_AVATARS = [
  { icon: "👤", label: "Klasik", color: "#FF5500" },
  { icon: "👦", label: "Çocuk (Erkek)", color: "#00C853" },
  { icon: "👧", label: "Çocuk (Kız)", color: "#FF4081" },
  { icon: "🎧", label: "Dinleyici", color: "#2979FF" },
  { icon: "📚", label: "Kitap Kurdu", color: "#AA00FF" },
  { icon: "🦁", label: "Aslan", color: "#FFAB00" },
  { icon: "🦊", label: "Tilki", color: "#FF6D00" },
  { icon: "🦉", label: "Baykuş", color: "#795548" },
  { icon: "🚀", label: "Kaşif", color: "#00B0FF" },
  { icon: "✨", label: "Yıldız", color: "#FFD600" },
];

export function getProfileDir(profileId: string): string {
  ensureDataDirs();
  const dir = path.join(PROFILES_DIR, profileId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDefaultProfiles(): ProfilesStoreData {
  return {
    activeProfileId: "p-main",
    profiles: [
      {
        id: "p-main",
        name: "Ana Hesap",
        avatar: "👤",
        color: "#FF5500",
        isMain: true,
        isKid: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "p-kid",
        name: "Çocuk",
        avatar: "👦",
        color: "#00C853",
        isMain: false,
        isKid: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function getProfilesStore(): ProfilesStoreData {
  ensureDataDirs();
  if (!fs.existsSync(PROFILES_PATH)) {
    const defaults = getDefaultProfiles();
    fs.writeFileSync(PROFILES_PATH, JSON.stringify(defaults, null, 2), "utf8");
    // Ensure directories exist
    getProfileDir("p-main");
    getProfileDir("p-kid");
    return defaults;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8")) as ProfilesStoreData;
    if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) {
      const defaults = getDefaultProfiles();
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(defaults, null, 2), "utf8");
      return defaults;
    }
    return raw;
  } catch {
    const defaults = getDefaultProfiles();
    fs.writeFileSync(PROFILES_PATH, JSON.stringify(defaults, null, 2), "utf8");
    return defaults;
  }
}

export function saveProfilesStore(data: ProfilesStoreData): void {
  ensureDataDirs();
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function getActiveProfile(): UserProfile {
  const store = getProfilesStore();
  const found = store.profiles.find((p) => p.id === store.activeProfileId);
  return found || store.profiles[0] || getDefaultProfiles().profiles[0];
}

export function switchActiveProfile(profileId: string): UserProfile | null {
  const store = getProfilesStore();
  const target = store.profiles.find((p) => p.id === profileId);
  if (!target) return null;

  store.activeProfileId = target.id;
  saveProfilesStore(store);
  getProfileDir(target.id);
  return target;
}

export function createProfile(input: {
  name: string;
  avatar?: string;
  color?: string;
  isKid?: boolean;
}): { profile?: UserProfile; error?: string } {
  const store = getProfilesStore();

  if (store.profiles.length >= MAX_PROFILES) {
    return {
      error: `En fazla ${MAX_PROFILES} profil oluşturabilirsiniz (1 Ana Hesap, 1 Çocuk ve 3 Alt Hesap).`,
    };
  }

  const name = input.name.trim();
  if (!name) {
    return { error: "Profil adı boş olamaz." };
  }

  const id = `p-${crypto.randomUUID().slice(0, 8)}`;
  const avatar = input.avatar?.trim() || (input.isKid ? "👦" : "🎧");
  const color = input.color?.trim() || (input.isKid ? "#00C853" : "#2979FF");

  const newProfile: UserProfile = {
    id,
    name,
    avatar,
    color,
    isMain: false,
    isKid: Boolean(input.isKid),
    createdAt: new Date().toISOString(),
  };

  store.profiles.push(newProfile);
  saveProfilesStore(store);
  getProfileDir(id);

  return { profile: newProfile };
}

export function updateProfile(
  id: string,
  patch: {
    name?: string;
    avatar?: string;
    color?: string;
    isKid?: boolean;
    preferences?: ProfilePreferences;
  },
): { profile?: UserProfile; error?: string } {
  const store = getProfilesStore();
  const profile = store.profiles.find((p) => p.id === id);
  if (!profile) return { error: "Profil bulunamadı." };

  if (typeof patch.name === "string" && patch.name.trim()) {
    profile.name = patch.name.trim();
  }
  if (typeof patch.avatar === "string" && patch.avatar.trim()) {
    profile.avatar = patch.avatar.trim();
  }
  if (typeof patch.color === "string" && patch.color.trim()) {
    profile.color = patch.color.trim();
  }
  if (typeof patch.isKid === "boolean" && !profile.isMain) {
    profile.isKid = patch.isKid;
  }
  if (patch.preferences) {
    profile.preferences = { ...profile.preferences, ...patch.preferences };
  }

  saveProfilesStore(store);
  return { profile };
}

export function deleteProfile(id: string): { success: boolean; error?: string } {
  const store = getProfilesStore();
  const target = store.profiles.find((p) => p.id === id);

  if (!target) return { success: false, error: "Profil bulunamadı." };
  if (target.isMain) {
    return { success: false, error: "Ana hesap profili silinemez." };
  }

  store.profiles = store.profiles.filter((p) => p.id !== id);

  // If the deleted profile was active, switch to main profile
  if (store.activeProfileId === id) {
    const main = store.profiles.find((p) => p.isMain) || store.profiles[0];
    store.activeProfileId = main.id;
  }

  saveProfilesStore(store);

  // Clean up directory
  const dir = path.join(PROFILES_DIR, id);
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {}

  return { success: true };
}
