import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireStorytelClient } from "@/lib/api-helpers";

const schema = z.object({
  consumableId: z.string().min(1),
  positionMs: z.number().min(0),
});

const DEVICE_ID = crypto.randomUUID().toUpperCase();

export async function PUT(request: Request) {
  const auth = await requireStorytelClient();
  if (auth.error) return auth.error;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz pozisyon verisi." }, { status: 400 });
    }
    const { getActiveProfile } = await import("@/lib/profiles");
    const activeProfile = getActiveProfile();

    // Only sync back to remote Storytel servers for the Main profile so sub-profiles never overwrite main progress
    if (activeProfile.isMain) {
      await auth.client.updatePositionalBookmark(
        parsed.data.consumableId,
        parsed.data.positionMs,
        DEVICE_ID,
      );
    }

    // Save into active profile's isolated local store
    const { saveProfilePosition } = await import("@/lib/local-store");
    saveProfilePosition(parsed.data.consumableId, parsed.data.positionMs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Also support POST for navigator.sendBeacon on tab close
export async function POST(request: Request) {
  return PUT(request);
}
