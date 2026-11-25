import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import {
  createProfile,
  deleteProfile,
  getActiveProfile,
  getProfilesStore,
  MAX_PROFILES,
  sanitizeProfile,
  updateProfile,
} from "@/lib/profiles";

const createSchema = z.object({
  name: z.string().min(1, "Profil adı boş olamaz").max(24, "Profil adı en fazla 24 karakter olabilir"),
  avatar: z.string().optional(),
  color: z.string().optional(),
  isKid: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(24).optional(),
  avatar: z.string().optional(),
  color: z.string().optional(),
  isKid: z.boolean().optional(),
  pin: z.string().max(6).optional(),
  dailyLimitMinutes: z.number().min(5).max(300).nullable().optional(),
  preferences: z
    .object({
      theme: z.enum(["dark", "light"]).optional(),
      lang: z.enum(["tr", "en"]).optional(),
      playbackSpeed: z.number().min(0.5).max(3.0).optional(),
    })
    .optional(),
});

export async function GET() {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  const store = getProfilesStore();
  const activeProfile = getActiveProfile();

  return NextResponse.json({
    profiles: store.profiles.map(sanitizeProfile),
    activeProfile: sanitizeProfile(activeProfile),
    activeProfileId: store.activeProfileId,
    maxProfiles: MAX_PROFILES,
  });
}

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri" },
        { status: 400 },
      );
    }

    const res = createProfile(parsed.data);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    const store = getProfilesStore();
    return NextResponse.json({
      ok: true,
      profile: res.profile ? sanitizeProfile(res.profile) : undefined,
      profiles: store.profiles.map(sanitizeProfile),
      activeProfile: sanitizeProfile(getActiveProfile()),
    });
  } catch {
    return NextResponse.json({ error: "Profil oluşturulamadı" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const json = await request.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri" },
        { status: 400 },
      );
    }

    const res = updateProfile(parsed.data.id, parsed.data);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    const store = getProfilesStore();
    return NextResponse.json({
      ok: true,
      profile: res.profile ? sanitizeProfile(res.profile) : undefined,
      profiles: store.profiles.map(sanitizeProfile),
      activeProfile: sanitizeProfile(getActiveProfile()),
    });
  } catch {
    return NextResponse.json({ error: "Profil güncellenemedi" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Profil ID gerekli" }, { status: 400 });
    }

    const res = deleteProfile(id);
    if (!res.success) {
      return NextResponse.json({ error: res.error || "Silinemedi" }, { status: 400 });
    }

    const store = getProfilesStore();
    return NextResponse.json({
      ok: true,
      profiles: store.profiles.map(sanitizeProfile),
      activeProfile: sanitizeProfile(getActiveProfile()),
    });
  } catch {
    return NextResponse.json({ error: "Profil silinemedi" }, { status: 500 });
  }
}
