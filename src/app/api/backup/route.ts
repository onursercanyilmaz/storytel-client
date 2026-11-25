import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireStorytelClient } from "@/lib/api-helpers";
import { DATA_DIR, ensureDataDirs } from "@/lib/paths";
import { getProfilesStore } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  ensureDataDirs();
  const store = getProfilesStore();
  const profileData: Record<string, Record<string, unknown>> = {};

  for (const p of store.profiles) {
    const dir = path.join(DATA_DIR, "profiles", p.id);
    profileData[p.id] = {};
    for (const fname of [
      "library-meta.json",
      "listening-stats.json",
      "vocabulary.json",
      "highlights.json",
      "playback-positions.json",
    ]) {
      const fpath = path.join(dir, fname);
      if (fs.existsSync(fpath)) {
        try {
          profileData[p.id][fname] = JSON.parse(fs.readFileSync(fpath, "utf8"));
        } catch {}
      }
    }
  }

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    profilesStore: store,
    profileData,
  });
}

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !body.profilesStore ||
      !Array.isArray(body.profilesStore.profiles) ||
      typeof body.profileData !== "object"
    ) {
      return NextResponse.json({ error: "Geçersiz yedek dosyası." }, { status: 400 });
    }

    ensureDataDirs();
    fs.writeFileSync(
      path.join(DATA_DIR, "profiles.json"),
      JSON.stringify(body.profilesStore, null, 2),
      "utf8",
    );

    const allowedFiles = new Set([
      "library-meta.json",
      "listening-stats.json",
      "vocabulary.json",
      "highlights.json",
      "playback-positions.json",
    ]);

    for (const [pid, files] of Object.entries(body.profileData as Record<string, Record<string, unknown>>)) {
      if (!/^[a-zA-Z0-9_-]{1,32}$/.test(pid)) continue;
      const dir = path.join(DATA_DIR, "profiles", pid);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      for (const [fname, content] of Object.entries(files || {})) {
        if (!allowedFiles.has(fname)) continue;
        fs.writeFileSync(path.join(dir, fname), JSON.stringify(content, null, 2), "utf8");
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Yedek geri yüklenemedi." }, { status: 500 });
  }
}
