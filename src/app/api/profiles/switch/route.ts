import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfilesStore, switchActiveProfile } from "@/lib/profiles";

const schema = z.object({
  profileId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz profil ID" }, { status: 400 });
    }

    const target = switchActiveProfile(parsed.data.profileId);
    if (!target) {
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }

    const store = getProfilesStore();
    const res = NextResponse.json({
      ok: true,
      activeProfile: target,
      profiles: store.profiles,
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
