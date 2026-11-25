import type { ListeningStats, VocabEntry } from "./storytel/types";

export type SrsQuality = 0 | 2 | 3 | 5; // 0: Again, 2: Hard, 3: Good, 5: Easy

export function computeNextSrs(
  entry: Pick<VocabEntry, "srsInterval" | "srsEase" | "srsReps">,
  quality: SrsQuality,
  now = new Date(),
): {
  srsInterval: number;
  srsEase: number;
  srsReps: number;
  nextReviewAt: string;
  mastered: boolean;
} {
  let ease = entry.srsEase ?? 2.5;
  let reps = entry.srsReps ?? 0;
  let interval = entry.srsInterval ?? 0;

  if (quality < 3) {
    reps = 0;
    interval = quality === 0 ? 1 : 1;
  } else {
    if (reps === 0) {
      interval = 1;
    } else if (reps === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease);
    }
    if (quality === 5) {
      interval = Math.max(interval + 1, Math.round(interval * 1.3));
    }
    reps += 1;
  }

  ease = Math.max(
    1.3,
    ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const next = new Date(now.getTime() + interval * 86400_000);
  return {
    srsInterval: interval,
    srsEase: Number(ease.toFixed(2)),
    srsReps: reps,
    nextReviewAt: next.toISOString(),
    mastered: reps >= 3 && interval >= 6,
  };
}

export function isDueForReview(entry: VocabEntry, now = new Date()): boolean {
  if (!entry.nextReviewAt) return !entry.mastered;
  return new Date(entry.nextReviewAt).getTime() <= now.getTime();
}

export interface StreakAndBadges {
  currentStreakDays: number;
  longestStreakDays: number;
  todaySeconds: number;
  dailyGoalMinutes: number;
  yearlyBookGoal: number;
  badges: {
    id: string;
    icon: string;
    titleTr: string;
    titleEn: string;
    unlocked: boolean;
  }[];
}

export function computeStreaksAndBadges(
  stats: ListeningStats,
  vocabCount = 0,
  now = new Date(),
): StreakAndBadges {
  const dailyGoalMinutes = stats.dailyGoalMinutes ?? 20;
  const yearlyBookGoal = stats.yearlyBookGoal ?? 12;
  const todayKey = now.toISOString().slice(0, 10);
  const todaySeconds = stats.dailySeconds[todayKey] || 0;

  // Compute current streak (allowing today to be 0 if yesterday had listening)
  let currentStreak = 0;
  const cursor = new Date(now);
  if ((stats.dailySeconds[todayKey] || 0) <= 0) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const k = cursor.toISOString().slice(0, 10);
    if ((stats.dailySeconds[k] || 0) >= 60) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Compute longest streak across recorded days
  const activeDays = Object.entries(stats.dailySeconds)
    .filter(([, sec]) => sec >= 60)
    .map(([day]) => day)
    .sort();
  let longest = 0;
  let run = 0;
  let prevTime = 0;
  for (const day of activeDays) {
    const t = new Date(day + "T00:00:00Z").getTime();
    if (prevTime && t - prevTime === 86400_000) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prevTime = t;
  }
  longest = Math.max(longest, currentStreak);

  const totalHours = stats.totalSeconds / 3600;
  const badges = [
    {
      id: "first-listen",
      icon: "🎧",
      titleTr: "İlk Adım (15+ dk)",
      titleEn: "First Step (15m+)",
      unlocked: stats.totalSeconds >= 900,
    },
    {
      id: "streak-3",
      icon: "🔥",
      titleTr: "3 Günlük Seri",
      titleEn: "3-Day Streak",
      unlocked: longest >= 3,
    },
    {
      id: "streak-7",
      icon: "⚡",
      titleTr: "7 Günlük Seri",
      titleEn: "7-Day Streak",
      unlocked: longest >= 7,
    },
    {
      id: "hours-10",
      icon: "🏆",
      titleTr: "10 Saat Dinleme",
      titleEn: "10 Hours Listened",
      unlocked: totalHours >= 10,
    },
    {
      id: "vocab-10",
      icon: "🧠",
      titleTr: "Kelime Avcısı (10+)",
      titleEn: "Word Hunter (10+)",
      unlocked: vocabCount >= 10,
    },
    {
      id: "books-5",
      icon: "📚",
      titleTr: "Kitap Kurdu (5+ Kitap)",
      titleEn: "Bookworm (5+ Books)",
      unlocked: stats.recentBooks.length >= 5,
    },
  ];

  return {
    currentStreakDays: currentStreak,
    longestStreakDays: longest,
    todaySeconds,
    dailyGoalMinutes,
    yearlyBookGoal,
    badges,
  };
}
