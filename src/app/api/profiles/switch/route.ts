import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStorytelClient } from "@/lib/api-helpers";
import {
  getProfilesStore,
  isPinRequiredForSwitch,
  sanitizeProfile,
  switchActiveProfile,
} from "@/lib/profiles";

const schema = z.object({
  profileId: z.string().min(1),
  pin: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz profil ID" }, { status: 400 });
    }

    const storeBefore = getProfilesStore();
    const exists = storeBefore.profiles.some((p) => p.id === parsed.data.profileId);
    if (!exists) {
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }

    const needsPin = isPinRequiredForSwitch(parsed.data.profileId);
    const target = switchActiveProfile(parsed.data.profileId, parsed.data.pin);
    if (!target) {
      if (needsPin) {
        return NextResponse.json(
          {
            error: parsed.data.pin ? "Hatalı PIN kodu" : "Bu geçiş için ebeveyn/profil PIN'i gerekli",
            pinRequired: true,
          },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }

    const store = getProfilesStore();
    const res = NextResponse.json({
      ok: true,
      activeProfile: sanitizeProfile(target),
      profiles: store.profiles.map(sanitizeProfile),
    });

    // Set cookie for active profile
    res.cookies.set("st_profile_id", target.id, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Profil değiştirilemedi" }, { status: 500 });
  }
}
