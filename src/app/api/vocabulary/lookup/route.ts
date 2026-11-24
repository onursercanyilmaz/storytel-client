import { NextResponse } from "next/server";
import { requireStorytelClient } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * Normalizes 2 or 3-letter language codes to standard 2-letter ISO 639-1.
 */
function normalizeLangCode(code?: string | null): string {
  if (!code) return "";
  const cleaned = code.toLowerCase().trim().slice(0, 3);
  const map: Record<string, string> = {
    tur: "tr",
    tr: "tr",
    eng: "en",
    en: "en",
    ger: "de",
    deu: "de",
    de: "de",
    fre: "fr",
    fra: "fr",
    fr: "fr",
    spa: "es",
    es: "es",
    ita: "it",
    it: "it",
    rus: "ru",
    ru: "ru",
    swe: "sv",
    sve: "sv",
    sv: "sv",
    nld: "nl",
    dut: "nl",
    nl: "nl",
    por: "pt",
    pt: "pt",
    dan: "da",
    da: "da",
    nor: "no",
    nob: "no",
    nno: "no",
    no: "no",
    fin: "fi",
    fi: "fi",
    pol: "pl",
    pl: "pl",
    ara: "ar",
    ar: "ar",
    jpn: "ja",
    ja: "ja",
  };
  return map[cleaned] || cleaned.slice(0, 2);
}

/**
 * Multilingual vocabulary & translation lookup:
 * - English <-> Turkish by default
 * - Auto-detects book source language (German, French, Spanish, Russian, Swedish, etc.) and translates to Turkish
 * - Queries Google Translate (GTX), MyMemory, and Free Dictionary API in parallel.
 */
export async function GET(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const word = (searchParams.get("word") || "").trim();
  if (!word || word.length > 100) {
    return NextResponse.json({ error: "Geçersiz kelime." }, { status: 400 });
  }

  const rawFrom = normalizeLangCode(searchParams.get("from") || searchParams.get("src"));
  const rawTo = normalizeLangCode(searchParams.get("to") || searchParams.get("tgt"));

  // Detect Turkish characters if language is unspecified
  const hasTurkishChars = /[çğıöşüİĞŞÇÖÜ]/.test(word);

  let sl = rawFrom;
  let tl = rawTo;

  if (!sl) {
    sl = hasTurkishChars ? "tr" : "en";
  }

  if (!tl) {
    if (sl === "tr") {
      tl = "en";
    } else {
      // For English or any other foreign language (German, French, Spanish, Russian, etc.), translate to Turkish by default
      tl = "tr";
    }
  }

  // Prevent same-language translation
  if (sl === tl) {
    tl = sl === "tr" ? "en" : "tr";
  }

  // Fetch translations and definitions in parallel
  const [googleRes, myMemoryRes, dictRes] = await Promise.all([
    // 1. Google Translate GTX (High accuracy for 100+ languages)
    fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),

    // 2. MyMemory (human crowd translation fallback)
    fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${sl}|${tl}`,
      { signal: AbortSignal.timeout(5000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),

    // 3. Free Dictionary API (when English is either source or target, provides IPA phonetics and audio)
    (sl === "en" || tl === "en")
      ? fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.split(/\s+/)[0])}`,
          { signal: AbortSignal.timeout(5000) },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  // Extract Google Translation
  let gTranslation = "";
  if (Array.isArray(googleRes?.[0])) {
    gTranslation = googleRes[0]
      .map((item: any) => item?.[0])
      .filter(Boolean)
      .join("")
      .trim();
  }

  // Extract Google transliteration/phonetic if available
  let gPhonetic = "";
  if (Array.isArray(googleRes?.[0])) {
    const roman = googleRes[0].find((item: any) => typeof item?.[3] === "string");
    if (roman?.[3]) gPhonetic = roman[3];
  }

  // Extract MyMemory translation
  const mmTranslation = String(myMemoryRes?.responseData?.translatedText || "").trim();

  // Pick best translation
  const translation =
    gTranslation ||
    (mmTranslation && mmTranslation.toLowerCase() !== word.toLowerCase()
      ? mmTranslation
      : "") ||
    word;

  // Extract Dictionary API info (IPA phonetics, English definitions)
  const firstDictEntry = Array.isArray(dictRes) ? dictRes[0] : null;
  const dictPhonetic = String(
    firstDictEntry?.phonetic ||
      firstDictEntry?.phonetics?.find((p: any) => p?.text)?.text ||
      "",
  ).trim();

  const dictDefinition = String(
    firstDictEntry?.meanings?.[0]?.definitions?.[0]?.definition || "",
  ).trim();

  const phonetic = dictPhonetic || gPhonetic;

  // Compose clear, informative meaning
  let meaning = translation;
  if (dictDefinition && translation && translation.toLowerCase() !== dictDefinition.toLowerCase()) {
    meaning = `${translation} — ${dictDefinition}`;
  } else if (!meaning && dictDefinition) {
    meaning = dictDefinition;
  }

  return NextResponse.json({
    word,
    translation,
    definition: dictDefinition,
    meaning,
    phonetic,
    from: sl,
    to: tl,
  });
}
