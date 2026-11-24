"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PreferencesProvider } from "@/components/PreferencesContext";
import { PlayerProvider } from "@/components/PlayerContext";
import LoginView from "@/components/LoginView";
import StorytelApp from "@/components/StorytelApp";

function AppRoot() {
  const [checking, setChecking] = useState(true);
  const [auth, setAuth] = useState<{
    authenticated: boolean;
    email: string;
    authMode: "sso" | "legacy";
  }>({
    authenticated: false,
    email: "",
    authMode: "sso",
  });

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setAuth({
            authenticated: true,
            email: data.email || "",
            authMode: data.authMode || "sso",
          });
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen st-bg flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#FF5500] animate-spin" />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <LoginView
        onSuccess={(email, authMode) =>
          setAuth({ authenticated: true, email, authMode })
        }
      />
    );
  }

  return (
    <PlayerProvider>
      <StorytelApp
        email={auth.email}
        authMode={auth.authMode}
        onLogout={() =>
          setAuth({ authenticated: false, email: "", authMode: "sso" })
        }
      />
    </PlayerProvider>
  );
}

export default function HomePage() {
  return (
    <PreferencesProvider>
      <AppRoot />
    </PreferencesProvider>
  );
}
