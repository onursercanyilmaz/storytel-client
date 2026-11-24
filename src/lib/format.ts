export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDurationMs(ms: number): string {
  if (!ms || ms <= 0) return "";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h} sa ${m} dk`;
  if (h > 0) return `${h} sa`;
  return `${m} dk`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const LANGUAGE_LABELS: Record<string, string> = {
  tr: "Türkçe",
  en: "İngilizce",
  de: "Almanca",
  fr: "Fransızca",
  es: "İspanyolca",
  it: "İtalyanca",
  sv: "İsveççe",
  fi: "Fince",
  pl: "Lehçe",
  nl: "Felemenkçe",
  ar: "Arapça",
  ru: "Rusça",
  da: "Danca",
  no: "Norveççe",
};

export function getLanguageLabel(code?: string, fallbackName?: string): string {
  if (!code && !fallbackName) return "Diğer";
  const clean = (code || "").toLowerCase().trim();
  if (LANGUAGE_LABELS[clean]) return LANGUAGE_LABELS[clean];
  if (fallbackName) return fallbackName;
  return clean.toUpperCase();
}
