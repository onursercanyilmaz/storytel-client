"use client";

import React, { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import StorytelLogo from "./StorytelLogo";
import { usePreferences } from "./PreferencesContext";

interface LoginViewProps {
  onSuccess: (email: string, authMode: "sso" | "legacy") => void;
}

export default function LoginView({ onSuccess }: LoginViewProps) {
  const { lang, theme, toggleLang, toggleTheme, t } = usePreferences();
  const [ssoState, setSsoState] = useState<string>("idle");
  const [ssoMessage, setSsoMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const isSsoRunning =
    ssoState === "launching" ||
    ssoState === "waiting_login" ||
    ssoState === "capturing";

  useEffect(() => {
    if (!isSsoRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/sso/status", { cache: "no-store" });
        const data = await res.json();
        setSsoState(data.state);
        setSsoMessage(data.message || "");
        if (data.state === "success") {
          clearInterval(interval);
          onSuccess(data.email || "", "sso");
        } else if (data.state === "error") {
          setError(data.error || data.message || "Giriş başarısız.");
        }
      } catch {
        // keep polling
      }
    }, 800);
    return () => clearInterval(interval);
  }, [isSsoRunning, onSuccess]);

  const handleStartSso = async () => {
    setError("");
    setSsoState("launching");
    setSsoMessage("Storytel giriş penceresi açılıyor...");
    try {
      const res = await fetch("/api/auth/sso/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSsoState("error");
        setError(data.error || "SSO başlatılamadı.");
        return;
      }
      setSsoState(data.state);
      setSsoMessage(data.message || "");
      if (data.state === "error") {
        setError(data.error || data.message);
      }
    } catch {
      setSsoState("error");
      setError("Sunucuya bağlanılamadı.");
    }
  };

  const handleCancelSso = async () => {
    await fetch("/api/auth/sso/cancel", { method: "POST" }).catch(() => {});
    setSsoState("idle");
    setSsoMessage("");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Giriş başarısız.");
        return;
      }
      onSuccess(data.email || email, "legacy");
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen st-bg flex flex-col">
      {/* Top Bar */}
      <header className="px-6 sm:px-10 py-5 flex items-center justify-between">
        <StorytelLogo size="md" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            className="px-3 py-1.5 rounded-full st-surface border st-border text-xs font-bold st-ink hover:border-[#FF5500] inline-flex items-center gap-1.5 transition cursor-pointer"
            title="Switch Language / Dil Değiştir"
          >
            <Globe className="w-3.5 h-3.5 text-[#FF5500]" />
            {lang.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-full st-surface border st-border st-muted hover:text-[#FF5500] transition cursor-pointer"
            title={theme === "dark" ? t("nav.themeLight") : t("nav.themeDark")}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Centered Editorial Card */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-[440px] st-surface border st-border rounded-3xl p-8 sm:p-10 shadow-xl shadow-black/5">
          <div className="text-center mb-8">
            <h1 className="font-serif-st text-3xl font-bold st-ink tracking-tight">
              {t("login.headline")}
            </h1>
            <p className="text-sm st-muted mt-2">{t("login.desc")}</p>
          </div>

          {!isSsoRunning ? (
            <button
              type="button"
              onClick={handleStartSso}
              className="w-full py-3.5 px-5 rounded-full st-accent-bg text-white font-semibold text-sm transition flex items-center justify-center gap-3 shadow-md shadow-[#FF5500]/25 cursor-pointer"
            >
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 5.1 29.3 3 24 3 16.3 3 9.7 7.4 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 45c5.2 0 9.9-2 13.4-5.3l-6.2-5.2C29.2 36 26.7 37 24 37c-5.4 0-9.7-3.4-11.3-8.1L6.1 34C9.5 41.6 16.1 45 24 45z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.2 0-1.2-.1-2.4-.4-3.5z"
                  />
                </svg>
              </span>
              {t("login.google")}
            </button>
          ) : (
            <div className="rounded-2xl st-accent-soft border border-[#FF5500]/30 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-[#FF5500] animate-spin shrink-0 mt-0.5" />
                <p className="text-sm st-ink leading-relaxed">
                  {ssoMessage || "..."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelSso}
                className="w-full py-2 px-3 rounded-full st-surface border st-border text-xs font-semibold st-ink hover:opacity-80 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                {t("login.cancel")}
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px st-border border-t" />
            <button
              type="button"
              onClick={() => setShowEmailForm((v) => !v)}
              className="text-xs font-semibold st-muted hover:text-[#FF5500] transition cursor-pointer"
            >
              {showEmailForm ? t("login.hideEmail") : t("login.showEmail")}
            </button>
            <div className="flex-1 h-px st-border border-t" />
          </div>

          {showEmailForm && (
            <form onSubmit={handleEmailSubmit} className="space-y-3 mb-5">
              <div className="relative">
                <Mail className="w-4 h-4 st-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl st-bg border st-border text-sm st-ink placeholder:text-[#9A938A] focus:outline-none focus:border-[#FF5500] transition"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 st-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder")}
                  className="w-full pl-11 pr-11 py-3 rounded-2xl st-bg border st-border text-sm st-ink placeholder:text-[#9A938A] focus:outline-none focus:border-[#FF5500] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 st-muted hover:text-[#FF5500] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={emailLoading}
                className="w-full py-3 rounded-full bg-[#1A1715] dark:bg-[#FAF7F2] text-white dark:text-[#1A1715] font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("login.submit")}
              </button>
            </form>
          )}

          {error && (
            <div className="mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-400 text-center font-medium">
              {error}
            </div>
          )}

          <div className="mt-6 pt-5 border-t st-border flex items-start gap-2.5 text-xs st-muted">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t("login.security")}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
