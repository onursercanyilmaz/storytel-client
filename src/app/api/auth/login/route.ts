import { NextResponse } from "next/server";
import { z } from "zod";
import { StorytelClient } from "@/lib/storytel/client";
import { saveLegacySession, setSessionCookie } from "@/lib/session";
import { handleApiError } from "@/lib/api-helpers";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin."),
  password: z.string().min(1, "Şifre gereklidir."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Geçersiz giriş bilgileri." },
        { status: 400 },
      );
    }

    // Password is ONLY used in-transit and NEVER persisted to disk
    const creds = await StorytelClient.loginWithEmailPassword(
      parsed.data.email,
      parsed.data.password,
    );
    const session = saveLegacySession(creds);
    await setSessionCookie(session.sid);

    return NextResponse.json({
      success: true,
      email: session.email,
      authMode: session.authMode,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
