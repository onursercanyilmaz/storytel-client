import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "./session";
import { StorytelClient, StorytelUnauthorizedError } from "./storytel/client";

export async function requireStorytelClient(): Promise<
  | { client: StorytelClient; email: string; error?: undefined }
  | { client?: undefined; email?: undefined; error: NextResponse }
> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Oturum açılmadı." },
        { status: 401 },
      ),
    };
  }
  return {
    client: new StorytelClient(session),
    email: session.email,
  };
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof StorytelUnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  const message =
    err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
  return NextResponse.json({ error: message }, { status: 500 });
}
