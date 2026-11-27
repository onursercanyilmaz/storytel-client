<p align="right">
  <b>English</b> • <a href="README.tr.md">Türkçe</a>
</p>

<div align="center">

<img src="docs/banner.jpg" alt="storytel-client — Your audiobooks. On your desktop." width="100%" />

# storytel-client

**A modern, security-first unofficial desktop client & PWA for Storytel.**  
*Featuring a Split-Screen "Read & Listen" studio, multilingual vocabulary builder, library-based smart recommendations, and offline downloads.*

<p align="center">
  <a href="https://www.npmjs.com/package/storytel-client"><img src="https://img.shields.io/npm/v/storytel-client?style=flat-square&color=ff5500&logo=npm" alt="npm version" height="22" /></a>
  <a href="https://www.npmjs.com/package/storytel-client"><img src="https://img.shields.io/npm/dt/storytel-client?style=flat-square&color=cb3837&logo=npm" alt="npm downloads" height="22" /></a>
  <a href="https://github.com/onursercanyilmaz/storytel-client/releases"><img src="https://img.shields.io/github/v/release/onursercanyilmaz/storytel-client?style=flat-square&color=ff5500&logo=github" alt="GitHub Release" height="22" /></a>
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js" alt="Node.js 20+" height="22" />
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" height="22" />
  <img src="https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react" alt="React 19" height="22" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" alt="TypeScript 5" height="22" />
  <img src="https://img.shields.io/badge/License-MIT-ff5500?style=flat-square" alt="MIT License" height="22" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/storytel-client">
    <img src="https://nodei.co/npm/storytel-client.png?compact=true" alt="npm install storytel-client" />
  </a>
</p>

</div>

> [!IMPORTANT]
> **Active Storytel Subscription Required**  
> This application communicates directly with the official Storytel APIs using your own Storytel account. An **active Storytel subscription is strictly required** to stream audio, read e-books, or download media.  
> *(This is an independent, open-source desktop interface; it does not bypass subscription paywalls or host copyrighted media).*

---

## ⚡ Instant Launch via npm (`npx` / `npm i`)

Run **`storytel-client`** directly from your terminal with zero manual cloning (requires Node.js 20+):

```bash
# Run immediately with npx (zero install)
npx storytel-client

# Or install globally with npm i
npm i -g storytel-client
storytel-client --port 3000
```

**CLI Flags:** `--port <number>` (default `3000`), `--no-open` (skip auto-opening browser), `--help`.  
Your encrypted session, profiles, vocabulary, highlights, and offline MP3s are stored safely in `~/.storytel-client`. Desktop installers (`.exe`, `.deb`, `.AppImage`, `.dmg`) are also available on the [Releases](https://github.com/onursercanyilmaz/storytel-client/releases) page.

---

## 💡 Why We Built This

While Storytel offers an outstanding catalog of audiobooks and e-books, the official desktop experience has critical limitations:

1. **No Web Player or Reader on Desktop:** The official Storytel website does not support listening to audiobooks or reading e-books on desktop browsers — these capabilities are **strictly confined to mobile apps**. Working on a computer forced users to stay tethered to their phones.
2. **No Simultaneous "Read & Listen" Mode:** Even on official mobile apps, you can only listen OR read at any given time. There is no split-screen mode to follow the highlighted text while listening to professional voice narrators — an invaluable capability for language learners, accessibility, and focused reading.
3. **No Integrated Multilingual Vocabulary Tools:** When reading in foreign languages, there is no built-in way to double-click a word, see instant translations (with phonetic IPA and native audio pronunciation), and save it to an **Anki** / **CSV** flashcard deck for spaced repetition.
4. **No Desktop Personalized Discovery Feed:** The web catalog lacked a personalized recommendation hub tailored to the authors and genres in your listening history.
5. **No Local File Pairing or Direct Downloads:** Official apps do not allow pairing local `.epub` / `.pdf` files with audiobooks, nor do they provide direct downloads with upfront file size indicators for personal offline backups.

**`storytel-client`** was created to bridge this gap: an open, private, keyboard-friendly desktop workstation combining big-screen comfort, a split-screen Read & Listen studio, and powerful language acquisition tools with your existing Storytel subscription.

---

## Key Features

### 1. 📖🎧 Split-Screen Read & Listen Studio
Immerse yourself by reading and listening side by side:
- **Intelligent Audio Sync:** Automatically scrolls the e-book prose to keep pace with the audiobook narration.
- **Customizable Reader Atmosphere:** Sepia, Charcoal Dark, and Clean Light themes; Serif or Sans-serif typography; granular font size scaling.
- **Local File Uploads:** Listening to an audiobook without an official e-book release? Drag-and-drop your own local `.epub` or `.pdf` file to read along in real time.

### 2. 🌍 Multilingual Vocabulary Builder & Flashcards
Learn new languages naturally as you read:
- **Instant Double-Click Lookup:** Double-click or select any word in the text to summon an unobtrusive translation popup.
- **Smart Language Pairings:**
  - **English books:** English ➔ Turkish (`EN ➔ TR`) translation, IPA phonetic pronunciation, and English definition.
  - **Turkish books:** Turkish ➔ English (`TR ➔ EN`) translation.
  - **Global languages (German, French, Spanish, Russian, Swedish, etc.):** Direct translation from the book's native tongue to Turkish (`DE ➔ TR`, `FR ➔ TR`, `ES ➔ TR`...).
  - **1-Click Language Switch (⇄):** Seamlessly toggle target language between Turkish and English in the card.
- **Native Pronunciation:** Instant audio pronunciation in the original language via the Web Speech API.
- **Vocabulary Notebook & Flashcards:** Review saved words with interactive flashcards, mark them as mastered, and export directly to **Anki** or **CSV**.

### 3. ✨ Library-Based Smart Recommendations
- **Personalized Recommendation Engine:** The search & discover view analyzes your bookshelf, favorite authors, and genres to curate fresh, unread titles.
- **Contextual Recommendation Reasons:** Every suggested book displays why it was recommended (e.g. *✨ Because you listened to John Verdon* or *✨ Recommended from Mystery & Thriller*).
- **1-Click Discovery Chips:** Quick filter chips for top authors and categories from your shelf (`👤 Author`, `🏷️ Category`) let you explore with a single click.

### 4. 💾 File Downloads with Upfront Size Indicators (EPUB, MP3, PDF)
- **Pre-Download Size Transparency:** Download buttons display the exact or estimated file size beforehand (`Download MP3 (~370 MB)`, `Download EPUB (8.2 MB)`).
- **EPUB Download:** Grab the original `.epub` file for your e-reader directly from the book detail card or the reading studio.
- **MP3 Download:** Save audiobooks locally as standard `.mp3` files for offline listening in any media player.
- **Print / Save as PDF:** Clean `@media print` layout formatting e-book chapters into publication-grade PDFs.

### 5. 🔒 Secure Google SSO & Zero Password Storage
- **Google Login via CDP (Chrome / Edge):** Connects through an isolated session in your installed browser for Google OAuth; immune to automated bot blocks.
- **AES-256-GCM Encryption:** Session tokens are encrypted on disk with authenticated 256-bit AES-GCM (`.data/session.enc`).
- **Zero Plaintext Passwords:** Credentials are never written to disk or client scripts. The browser receives only an `HttpOnly; SameSite=Strict` session cookie.

### 6. 🎛️ Pro Audio Player & Seamless Mobile Sync
- **Pick Up Where You Left Off:** Instant bi-directional position sync matches the exact second you reached on your phone (`sendBeacon` + periodic updates).
- **Fine-Grained Speed Control:** Smooth playback rate adjustments from `0.5x` to `3.0x`.
- **Sleep Timer:** 5–60 minute countdown or "Stop at Chapter End".
- **OS Media Keys & Shortcuts:** Spacebar playback, `←/→` skipping, and native Web Media Session integration.

---

## Screenshots & Aesthetics

| Light Editorial Theme | Charcoal Dark Theme |
|:---:|:---:|
| Warm cream (`#FAF7F2`) with Storytel Orange accents (`#FF5500`) | Distraction-free charcoal (`#141210`) with crisp contrast |

| Split-Screen Read & Listen | Vocabulary Builder & Translation |
|:---:|:---:|
| Left: E-book prose / PDF, Right: Synchronized Audio Player | Double-click dictionary, native audio pronunciation, and flashcards |

---

## Quick Start (For Users)

### Prerequisites
- **Node.js 20+** (Node.js 22 or 24 recommended)
- **Google Chrome** or **Microsoft Edge** (for Google SSO)
- **Active Storytel Subscription**

### Installation & Launch

```bash
# 1. Clone the repository
git clone https://github.com/onursercanyilmaz/storytel-client.git
cd storytel-client

# 2. Install dependencies
npm install

# 3. Build and launch production server
npm run build
npm run start
```

Open **`http://127.0.0.1:3000`** in your browser and click **Sign in with Google**.

> **PWA Desktop App Tip:**  
> Click the **"Install App"** icon in your Chrome or Edge address bar to launch `storytel-client` as a native, borderless desktop window without Electron's 200+ MB RAM overhead.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` | Rewind 15 seconds |
| `→` | Forward 30 seconds |
| `M` | Mute / Unmute |
| `Ctrl + K` / `Cmd + K` | Focus universal catalog search |
| Media Keys | Play, pause, previous/next track |

---

## Developer Guide

`storytel-client` is engineered around modern web standards, strict local privacy, and zero external runtime services.

### Tech Stack & Architecture

- **Framework:** Next.js 15.5 (App Router, Server Actions, Route Handlers)
- **UI:** React 19, Tailwind CSS v4, Lucide Icons
- **E-Book Parser:** Zero external dependencies. High-performance, streaming ZIP/EPUB extraction with sanitized HTML rendering using Node's native `zlib` (`src/lib/epub-parser.ts`).
- **Cryptographic Engine:** Authenticated AES-256-GCM encryption powered by Web Crypto and Node `crypto` (`src/lib/crypto.ts`).
- **Storytel API Client:** Fully typed client with single-flight Firebase token refreshes (`securetoken.googleapis.com`), 401 retry cycles, and HTTP Range streaming proxy (`src/lib/storytel/client.ts`).
- **Local Storage:** Isolated, encrypted JSON vaults under `.data/` (`session.enc`, `vocabulary.json`, `collections.json`, `stats.json`).

### Development Commands

```bash
npm run dev        # Starts hot-reloading development server
npm run build      # Produces optimized Next.js production build
npm run start      # Runs production server on 127.0.0.1:3000
npm test           # Runs all 22 unit, cryptographic, mock API, and E2E test suites
npm run typecheck  # Validates TypeScript types (tsc --noEmit)
```

### Project Directory Structure

```text
storytel-client/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/              # Google SSO start/status/logout and credentials
│   │   │   ├── books/[id]/        # Book metadata, chapters, bookmarks, and asset sizes
│   │   │   ├── bookshelf/         # Bookshelf listing, additions, and removals
│   │   │   ├── downloads/         # Offline MP3 download manager and stream delivery
│   │   │   ├── ebook/             # Storytel EPUB streaming, parsing, and downloads
│   │   │   ├── recommendations/   # Personalized library-based recommendation engine
│   │   │   ├── search/            # Multi-filtered catalog search endpoint
│   │   │   ├── stream/[id]/       # HTTP Range-compatible audio streaming proxy
│   │   │   └── vocabulary/        # Vocabulary notebook CRUD & multi-engine translation
│   │   ├── globals.css            # Storytel light & dark theme CSS variables
│   │   ├── layout.tsx             # Typography (Lora + Plus Jakarta Sans) and PWA manifest
│   │   └── page.tsx               # Entry page
│   ├── components/
│   │   ├── StorytelApp.tsx        # Main library, hero card, navigation tabs
│   │   ├── ReadAndListenView.tsx  # Split-screen Read & Listen studio & dictionary popup
│   │   ├── VocabularyView.tsx     # Vocabulary notebook, flashcard decks, Anki export
│   │   ├── BookDetailModal.tsx    # Modal with summary, size-badged MP3/EPUB downloads
│   │   ├── PlayerBar.tsx          # Persistent mini-player and expanded drawer
│   │   ├── PlayerContext.tsx      # Audio engine, Media Session API, position syncer
│   │   └── SearchView.tsx         # Personalized recommendations and filtered search
│   └── lib/
│       ├── crypto.ts              # AES-256-GCM encryption and URL sanitizer
│       ├── session.ts             # Encrypted server session and HttpOnly cookie management
│       ├── epub-parser.ts         # Zero-dependency streaming EPUB parser
│       ├── local-store.ts         # Favorites, custom collections, vocabulary, and stats
│       ├── downloads.ts           # MP3 background downloader
│       └── storytel/              # Storytel API client and TypeScript interfaces
└── tests/                         # 22 test suites covering crypto, parser, and E2E
```

### Security Architecture

| Security Measure | Implementation |
|---|---|
| **Localhost-Only Binding** | The server strictly binds to `127.0.0.1:3000`; never exposed to local networks (`0.0.0.0`). |
| **AES-256-GCM Encryption** | Active tokens are encrypted on disk inside `.data/session.enc` with a 256-bit ephemeral key. |
| **HttpOnly Cookie Isolation** | Storytel and Firebase tokens are never exposed to browser JavaScript (no `localStorage`). |
| **Zero Telemetry & Direct API** | No third-party proxy; requests route directly between your machine and official Storytel / Google endpoints. |

---

## Disclaimer

This software is an **independent, open-source, unofficial desktop client**. It is not affiliated with, endorsed by, or sponsored by Storytel AB. All Storytel trademarks, service marks, and copyrighted content are the property of Storytel AB.

To use this application, **you must possess a valid, active Storytel subscription**.

---

## License

[MIT](LICENSE) © 2026 onursercanyilmaz
