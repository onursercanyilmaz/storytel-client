"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Edit2, LogOut, Plus, ShieldCheck, Users } from "lucide-react";
import { MAX_PROFILES } from "@/lib/profile-types";
import { useProfiles } from "./ProfileContext";

interface ProfileDropdownProps {
  email: string;
  onLogout: () => void;
}

export default function ProfileDropdown({ email, onLogout }: ProfileDropdownProps) {
  const { profiles, activeProfile, switchProfile, setShowPickerModal } = useProfiles();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  if (!activeProfile) {
    return (
      <div className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full st-bg border st-border text-xs">
        <span className="w-6 h-6 rounded-full st-accent-bg text-white font-bold flex items-center justify-center">
          {(email || "S").charAt(0).toUpperCase()}
        </span>
        <span className="text-xs font-semibold st-ink truncate max-w-[120px]">
          {email?.split("@")[0] || "Storytel"}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full st-bg border st-border hover:border-[#FF5500] transition cursor-pointer group"
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 shadow"
          style={{
            backgroundColor: `${activeProfile.color}22`,
            border: `2px solid ${activeProfile.color}`,
          }}
        >
          {activeProfile.avatar}
        </span>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold st-ink max-w-[110px] truncate group-hover:text-[#FF5500] transition">
              {activeProfile.name}
            </span>
            {activeProfile.isKid && (
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] font-extrabold flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" />
                Çocuk
              </span>
            )}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 st-muted group-hover:st-ink transition ml-0.5" />
      </button>

      {/* Dropdown Popup Menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl st-surface border st-border shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Info */}
          <div className="px-3 py-2 border-b st-border/60">
            <div className="text-[11px] font-bold st-muted uppercase tracking-wider">
              Aktif Profil
            </div>
            <div className="text-sm font-bold st-ink truncate flex items-center gap-1.5 mt-0.5">
              <span>{activeProfile.avatar}</span>
              <span>{activeProfile.name}</span>
              {activeProfile.isMain && (
                <span className="text-[10px] font-bold text-[#FF5500]">(Ana Hesap)</span>
              )}
            </div>
            <div className="text-[11px] st-muted truncate mt-0.5">{email}</div>
          </div>

          {/* Profiles List for Quick Switch */}
          <div className="py-1 space-y-0.5">
            <div className="px-3 pt-2 pb-1 text-[11px] font-bold st-muted uppercase tracking-wider">
              Profil Değiştir
            </div>
            {profiles.map((p) => {
              const isActive = p.id === activeProfile.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    switchProfile(p.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-white/10 text-[#FF5500]"
                      : "st-ink hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{
                        backgroundColor: `${p.color}22`,
                        border: `2px solid ${p.color}`,
                      }}
                    >
                      {p.avatar}
                    </span>
                    <div className="truncate">
                      <div className="truncate font-bold">{p.name}</div>
                      <div className="text-[10px] st-muted">
                        {p.isMain ? "Ana Hesap" : p.isKid ? "Çocuk (Korumalı)" : "Alt Hesap"}
                      </div>
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-[#FF5500] shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Action Links */}
          <div className="border-t st-border/60 pt-1 mt-1 space-y-0.5">
            {profiles.length < MAX_PROFILES && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowPickerModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold st-ink hover:bg-white/5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FF5500]" />
                <span>Yeni Profil Ekle ({profiles.length}/{MAX_PROFILES})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowPickerModal(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold st-ink hover:bg-white/5 transition cursor-pointer"
            >
              <Users className="w-4 h-4 st-muted" />
              <span>Profilleri Yönet...</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
