"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type AppLang = "tr" | "en";
export type AppTheme = "light" | "dark";

const DICT = {
  tr: {
    // Login
    "login.subtitle": "Yerel Masaüstü Web Oynatıcısı",
    "login.headline": "Hikayelerin seni bekliyor",
    "login.desc": "Kitaplığına erişmek için Storytel hesabınla giriş yap.",
    "login.google": "Google ile Giriş Yap",
    "login.cancel": "İptal Et",
    "login.showEmail": "E-posta ile giriş yap",
    "login.hideEmail": "E-posta ile girişi gizle",
    "login.emailPlaceholder": "E-posta adresin",
    "login.passwordPlaceholder": "Şifren",
    "login.submit": "Giriş Yap",
    "login.security":
      "Yalnızca kendi bilgisayarında (127.0.0.1) çalışır. Oturumun AES-256-GCM ile şifrelenir, şifren diske yazılmaz.",

    // Nav
    "nav.library": "Kitaplığım",
    "nav.discover": "Keşfet",
    "nav.favorites": "Beğendiklerim",
    "nav.downloads": "İndirilenler",
    "nav.stats": "İstatistikler",
    "nav.logout": "Çıkış Yap",
    "nav.themeLight": "Açık Storytel Teması",
    "nav.themeDark": "Koyu Storytel Teması",

    // Library
    "lib.continueListening": "Dinlemeye Devam Et",
    "lib.completed": "tamamlandı",
    "lib.remaining": "kaldı",
    "lib.details": "Detaylar",
    "lib.searchPlaceholder": "Kitaplıkta ara...",
    "lib.sort.recent": "Son Dinlenen",
    "lib.sort.title": "İsim (A-Z)",
    "lib.sort.progress": "İlerleme",
    "lib.sort.duration": "Süre",
    "lib.tab.all": "Tümü",
    "lib.tab.consuming": "Dinleniyor",
    "lib.tab.will_consume": "Listem",
    "lib.tab.consumed": "Bitenler",
    "lib.groups": "Gruplarım:",
    "lib.newGroup": "Yeni Grup",
    "lib.loading": "Kitaplığın yükleniyor...",
    "lib.retry": "Tekrar Dene",
    "lib.emptyFavorites": "Henüz beğendiğin bir kitap yok.",
    "lib.emptyGroup":
      "Bu grupta henüz kitap yok. Kitap detayına tıklayıp bu gruba ekleyebilirsin.",
    "lib.emptyLibrary": "Gösterilecek kitap bulunamadı.",
    "lib.playing": "Çalıyor",
    "lib.createGroupTitle": "Yeni Grup Oluştur",
    "lib.groupNamePlaceholder": "Örn: Uyurken Dinlediklerim, Bilim Kurgu...",
    "lib.groupColor": "Grup Rengi",
    "lib.create": "Oluştur",

    // Search
    "search.title": "Keşfet & Ara",
    "search.placeholder": "Kitap, yazar, seslendiren veya seri ara...",
    "search.button": "Ara",
    "search.filter": "Filtrele:",
    "search.allLanguages": "Tüm Diller",
    "search.allCategories": "Tüm Kategoriler",
    "search.allDurations": "Tüm Süreler",
    "search.short": "Kısa (< 5 sa)",
    "search.medium": "Orta (5–12 sa)",
    "search.long": "Uzun (12+ sa)",
    "search.hasEbook": "E-kitap da olsun",
    "search.booksCount": "kitap",
    "search.searching": "Storytel kataloğunda aranıyor...",
    "search.emptyTitle": "Yeni hikayeler keşfet",
    "search.emptyDesc":
      "Arama yaptıktan sonra dil, kategori ve süreye göre filtreleyebilirsin.",
    "search.noResults": "Seçili kriterlere uygun sesli kitap bulunamadı.",
    "search.listen": "Dinle",
    "search.onShelf": "Kitaplıkta",
    "search.add": "Ekle",

    // Detail Modal
    "detail.narrator": "Seslendiren:",
    "detail.like": "Beğen",
    "detail.liked": "Beğenildi",
    "detail.download": "İndir",
    "detail.downloaded": "İndirildi",
    "detail.cancel": "İptal",
    "detail.remove": "Çıkar",
    "detail.addShelf": "Kitaplığa Ekle",
    "detail.tabAbout": "Hakkında",
    "detail.tabChapters": "Bölümler",
    "detail.tabBookmarks": "Yer İmleri",
    "detail.noDesc": "Bu kitap için açıklama bilgisi bulunamadı.",
    "detail.noChapters": "Bölüm listesi bulunamadı.",
    "detail.noBookmarks": "Henüz yer imi eklenmemiş.",
    "detail.bookmarkPlaceholder": "Mevcut konuma yer imi notu ekle...",

    // Player
    "player.nowPlaying": "Şimdi Dinleniyor",
    "player.bookDetail": "Kitap Detayı",
    "player.speed": "Okuma Hızı",
    "player.sleep": "Uyku Zamanlayıcısı",
    "player.sleepShort": "Uyku",
    "player.sleepOff": "Zamanlayıcıyı Kapat",
    "player.sleepEndChapter": "Bölüm Sonunda Durdur",
    "player.chapter": "Bölüm",
    "player.chapters": "Bölümler",
    "player.bookmarks": "Yer İmleri",
    "player.bookmarkShort": "Yer İmi",
    "player.min": "dk",

    // Downloads & Stats
    "dl.storage": "Çevrimdışı Depolama",
    "dl.booksDownloaded": "kitap indirildi",
    "dl.total": "Toplam",
    "dl.active": "Devam Eden İndirmeler",
    "dl.empty": "Henüz indirilmiş sesli kitap yok",
    "dl.emptyDesc":
      'Bir kitabın detayına tıklayıp "İndir" butonunu kullanabilirsin.',
    "dl.offlineReady": "Çevrimdışı Hazır",
    "stats.title": "Dinleme İstatistiklerim",
    "stats.total": "Toplam Dinleme",
    "stats.today": "Bugün",
    "stats.recentCount": "Son Dinlenenler",
    "stats.last7Days": "Son 7 Gün Dinleme Süresi (dk)",
    "stats.recentlyPlayed": "Son Dinlediklerin",
    "stats.hours": "sa",
  },
  en: {
    // Login
    "login.subtitle": "Local Desktop Web Player",
    "login.headline": "Your stories are waiting",
    "login.desc": "Sign in with your Storytel account to access your bookshelf.",
    "login.google": "Sign in with Google",
    "login.cancel": "Cancel",
    "login.showEmail": "Sign in with email",
    "login.hideEmail": "Hide email sign-in",
    "login.emailPlaceholder": "Email address",
    "login.passwordPlaceholder": "Password",
    "login.submit": "Sign In",
    "login.security":
      "Runs locally on your machine only (127.0.0.1). Your session is encrypted with AES-256-GCM and your password is never stored on disk.",

    // Nav
    "nav.library": "Bookshelf",
    "nav.discover": "Discover",
    "nav.favorites": "Favorites",
    "nav.downloads": "Downloads",
    "nav.stats": "Stats",
    "nav.logout": "Sign Out",
    "nav.themeLight": "Storytel Light Theme",
    "nav.themeDark": "Storytel Dark Theme",

    // Library
    "lib.continueListening": "Continue Listening",
    "lib.completed": "completed",
    "lib.remaining": "left",
    "lib.details": "Details",
    "lib.searchPlaceholder": "Filter bookshelf...",
    "lib.sort.recent": "Recently Played",
    "lib.sort.title": "Title (A–Z)",
    "lib.sort.progress": "Progress",
    "lib.sort.duration": "Duration",
    "lib.tab.all": "All",
    "lib.tab.consuming": "Listening",
    "lib.tab.will_consume": "Saved",
    "lib.tab.consumed": "Finished",
    "lib.groups": "My Groups:",
    "lib.newGroup": "New Group",
    "lib.loading": "Loading your bookshelf...",
    "lib.retry": "Try Again",
    "lib.emptyFavorites": "You haven't liked any books yet.",
    "lib.emptyGroup":
      "No books in this group yet. Open any book's details to assign it here.",
    "lib.emptyLibrary": "No books found.",
    "lib.playing": "Playing",
    "lib.createGroupTitle": "Create New Group",
    "lib.groupNamePlaceholder": "e.g. Bedtime, Sci-Fi, Commute...",
    "lib.groupColor": "Group Color",
    "lib.create": "Create",

    // Search
    "search.title": "Discover & Search",
    "search.placeholder": "Search titles, authors, narrators, or series...",
    "search.button": "Search",
    "search.filter": "Filter:",
    "search.allLanguages": "All Languages",
    "search.allCategories": "All Categories",
    "search.allDurations": "All Durations",
    "search.short": "Short (< 5h)",
    "search.medium": "Medium (5–12h)",
    "search.long": "Long (12h+)",
    "search.hasEbook": "Has E-book",
    "search.booksCount": "books",
    "search.searching": "Searching Storytel catalog...",
    "search.emptyTitle": "Discover new stories",
    "search.emptyDesc":
      "Search the catalog and filter results by language, category, or duration.",
    "search.noResults": "No audiobooks match the selected filters.",
    "search.listen": "Listen",
    "search.onShelf": "On Shelf",
    "search.add": "Add",

    // Detail Modal
    "detail.narrator": "Narrator:",
    "detail.like": "Like",
    "detail.liked": "Liked",
    "detail.download": "Download",
    "detail.downloaded": "Downloaded",
    "detail.cancel": "Cancel",
    "detail.remove": "Remove",
    "detail.addShelf": "Add to Shelf",
    "detail.tabAbout": "About",
    "detail.tabChapters": "Chapters",
    "detail.tabBookmarks": "Bookmarks",
    "detail.noDesc": "No description available for this audiobook.",
    "detail.noChapters": "No chapter information found.",
    "detail.noBookmarks": "No bookmarks yet.",
    "detail.bookmarkPlaceholder": "Add a bookmark note at current position...",

    // Player
    "player.nowPlaying": "Now Playing",
    "player.bookDetail": "Book Details",
    "player.speed": "Playback Speed",
    "player.sleep": "Sleep Timer",
    "player.sleepShort": "Sleep",
    "player.sleepOff": "Turn Off Timer",
    "player.sleepEndChapter": "Stop at End of Chapter",
    "player.chapter": "Chapter",
    "player.chapters": "Chapters",
    "player.bookmarks": "Bookmarks",
    "player.bookmarkShort": "Bookmark",
    "player.min": "min",

    // Downloads & Stats
    "dl.storage": "Offline Storage",
    "dl.booksDownloaded": "books downloaded",
    "dl.total": "Total",
    "dl.active": "Active Downloads",
    "dl.empty": "No downloaded audiobooks yet",
    "dl.emptyDesc":
      'Open any audiobook\'s details and click "Download" for offline listening.',
    "dl.offlineReady": "Offline Ready",
    "stats.title": "Listening Stats",
    "stats.total": "Total Listening",
    "stats.today": "Today",
    "stats.recentCount": "Recently Played",
    "stats.last7Days": "Last 7 Days Listening Time (min)",
    "stats.recentlyPlayed": "Recently Played",
    "stats.hours": "h",
  },
} as const;

export type TranslationKey = keyof typeof DICT.tr;

interface PreferencesContextValue {
  lang: AppLang;
  theme: AppTheme;
  setLang: (lang: AppLang) => void;
  toggleLang: () => void;
  toggleTheme: () => void;
  t: (key: TranslationKey) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<AppLang>("tr");
  const [theme, setThemeState] = useState<AppTheme>("dark");

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("st_lang");
      if (savedLang === "en" || savedLang === "tr") {
        setLangState(savedLang);
      } else if (
        typeof navigator !== "undefined" &&
        !navigator.language.toLowerCase().startsWith("tr")
      ) {
        setLangState("en");
      }

      const savedTheme = localStorage.getItem("st_theme");
      if (savedTheme === "light") {
        setThemeState("light");
        document.documentElement.classList.remove("dark");
      } else {
        setThemeState("dark");
        document.documentElement.classList.add("dark");
      }
    } catch {
      // ignore
    }
  }, []);

  const setLang = (next: AppLang) => {
    setLangState(next);
    try {
      localStorage.setItem("st_lang", next);
      document.documentElement.lang = next;
    } catch {
      // ignore
    }
  };

  const toggleLang = () => setLang(lang === "tr" ? "en" : "tr");

  const toggleTheme = () => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("st_theme", next);
    } catch {
      // ignore
    }
  };

  const t = (key: TranslationKey): string => DICT[lang][key] ?? DICT.tr[key];

  return (
    <PreferencesContext.Provider
      value={{ lang, theme, setLang, toggleLang, toggleTheme, t }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return ctx;
}
