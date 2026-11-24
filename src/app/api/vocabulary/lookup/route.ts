import { NextResponse } from "next/server";
import { requireStorytelClient } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * Looks up an English word's Turkish translation (MyMemory) and English
 * phonetic/definition (Free Dictionary API) in parallel with graceful fallbacks.
 */
export async function GET(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const word = (searchParams.get("word") || "").trim();
  if (!word || word.length > 100) {
    return NextResponse.json({ error: "Geçersiz kelime." }, { status: 400 });
  }

  const [trResult, dictResult] = await Promise.all([
    fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|tr`,
      { signal: AbortSignal.timeout(5000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.split(/\s+/)[0])}`,
      { signal: AbortSignal.timeout(5000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const translation = String(trResult?.responseData?.translatedText || "").trim();
  const firstEntry = Array.isArray(dictResult) ? dictResult[0] : null;
  const phonetic = String(
    firstEntry?.phonetic ||
      firstEntry?.phonetics?.find((p: any) => p?.text)?.text ||
      "",
  ).trim();
  const definition = String(
    firstEntry?.meanings?.[0]?.definitions?.[0]?.definition || "",
  ).trim();

  const meaning =
    translation && translation.toLowerCase() !== word.toLowerCase()
      ? definition
        ? `${translation} — ${definition}`
        : translation
      : definition || translation;

  return NextResponse.json({
    word,
    translation,
    definition,
    meaning,
    phonetic,
  });
}
