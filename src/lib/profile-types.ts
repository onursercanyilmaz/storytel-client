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
  hasPin?: boolean; // Public flag: true when parental/profile PIN is configured
  pinHash?: string; // Server-only SHA-256 hash (stripped before sending to client)
  dailyLimitMinutes?: number; // Optional daily listening limit for Kid profiles
  createdAt: string;
  preferences?: ProfilePreferences;
}

export interface ProfilesStoreData {
  activeProfileId: string;
  profiles: UserProfile[];
}

export const MAX_PROFILES = 5;

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
