"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserProfile } from "@/lib/profile-types";

interface ProfileContextType {
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  loading: boolean;
  showPickerModal: boolean;
  setShowPickerModal: (open: boolean) => void;
  switchProfile: (profileId: string) => Promise<boolean>;
  addProfile: (input: { name: string; avatar?: string; color?: string; isKid?: boolean }) => Promise<{ success: boolean; error?: string }>;
  editProfile: (id: string, patch: { name?: string; avatar?: string; color?: string; isKid?: boolean }) => Promise<{ success: boolean; error?: string }>;
  removeProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPickerModal, setShowPickerModal] = useState(false);

  const refreshProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
        setActiveProfile(data.activeProfile || null);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const switchProfile = async (profileId: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/profiles/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveProfile(data.activeProfile);
        setProfiles(data.profiles);
        setShowPickerModal(false);
        // Dispatch custom event to notify components to reload bookshelf/stats/favorites
        window.dispatchEvent(new CustomEvent("profile-switched", { detail: data.activeProfile }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const addProfile = async (input: {
    name: string;
    avatar?: string;
    color?: string;
    isKid?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setProfiles(data.profiles);
        return { success: true };
      }
      return { success: false, error: data.error || "Profil eklenemedi" };
    } catch {
      return { success: false, error: "Bağlantı hatası" };
    }
  };

  const editProfile = async (
    id: string,
    patch: { name?: string; avatar?: string; color?: string; isKid?: boolean },
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setProfiles(data.profiles);
        if (activeProfile?.id === id) {
          setActiveProfile(data.profile);
        }
        return { success: true };
      }
      return { success: false, error: data.error || "Güncellenemedi" };
    } catch {
      return { success: false, error: "Bağlantı hatası" };
    }
  };

  const removeProfile = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/profiles?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setProfiles(data.profiles);
        setActiveProfile(data.activeProfile);
        window.dispatchEvent(new CustomEvent("profile-switched", { detail: data.activeProfile }));
        return { success: true };
      }
      return { success: false, error: data.error || "Silinemedi" };
    } catch {
      return { success: false, error: "Bağlantı hatası" };
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        loading,
        showPickerModal,
        setShowPickerModal,
        switchProfile,
        addProfile,
        editProfile,
        removeProfile,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfiles must be used within a ProfileProvider");
  }
  return ctx;
}
