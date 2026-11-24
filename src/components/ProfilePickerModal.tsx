"use client";

import React, { useState } from "react";
import { Check, Edit2, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { MAX_PROFILES, PRESET_AVATARS, type UserProfile } from "@/lib/profile-types";
import { useProfiles } from "./ProfileContext";

export default function ProfilePickerModal() {
  const {
    profiles,
    activeProfile,
    showPickerModal,
    setShowPickerModal,
    switchProfile,
    addProfile,
    editProfile,
    removeProfile,
  } = useProfiles();

  const [isManaging, setIsManaging] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states for Add / Edit
  const [formName, setFormName] = useState("");
  const [formAvatar, setFormAvatar] = useState("👤");
  const [formColor, setFormColor] = useState("#FF5500");
  const [formIsKid, setFormIsKid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!showPickerModal) return null;

  const openAddForm = () => {
    setFormName("");
    setFormAvatar("🎧");
    setFormColor("#2979FF");
    setFormIsKid(false);
    setFormError(null);
    setShowAddForm(true);
    setEditingProfile(null);
  };

  const openEditForm = (profile: UserProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormAvatar(profile.avatar);
    setFormColor(profile.color);
    setFormIsKid(profile.isKid);
    setFormError(null);
    setShowAddForm(false);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Lütfen bir profil adı girin.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await addProfile({
      name: formName.trim(),
      avatar: formAvatar,
      color: formColor,
      isKid: formIsKid,
    });
    setSubmitting(false);
    if (res.success) {
      setShowAddForm(false);
    } else {
      setFormError(res.error || "Profil eklenemedi.");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    if (!formName.trim()) {
      setFormError("Lütfen bir profil adı girin.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await editProfile(editingProfile.id, {
      name: formName.trim(),
      avatar: formAvatar,
      color: formColor,
      isKid: editingProfile.isMain ? false : formIsKid,
    });
    setSubmitting(false);
    if (res.success) {
      setEditingProfile(null);
    } else {
      setFormError(res.error || "Güncellenemedi.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu profili silmek istediğinize emin misiniz? Bu profilin dinleme geçmişi ve favorileri silinir.")) {
      return;
    }
    const res = await removeProfile(id);
    if (res.success) {
      setEditingProfile(null);
    } else {
      alert(res.error || "Silinemedi");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl st-surface border st-border p-6 sm:p-10 text-center shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              sessionStorage.setItem("storytel_profile_chosen", "true");
            }
            setShowPickerModal(false);
            setIsManaging(false);
            setEditingProfile(null);
            setShowAddForm(false);
          }}
          className="absolute top-5 right-5 p-2 rounded-full st-muted hover:st-ink hover:bg-white/5 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <h2 className="text-2xl sm:text-4xl font-extrabold st-ink tracking-tight mb-2">
          {showAddForm
            ? "Yeni Profil Ekle"
            : editingProfile
            ? "Profili Düzenle"
            : isManaging
            ? "Profilleri Yönet"
            : "Kim Dinliyor?"}
        </h2>
        <p className="text-sm st-muted mb-8 max-w-md mx-auto">
          {showAddForm
            ? "Her profil kendi dinleme geçmişine, kaldığı yere ve favorilerine sahiptir."
            : editingProfile
            ? "Profil adını, avatarını ve çocuk filtresini özelleştirin."
            : isManaging
            ? "Düzenlemek istediğiniz profilin üzerine dokunun."
            : "Kendi kitaplığın, favorilerin ve kaldığın yer için profilini seç."}
        </p>

        {/* Form: Add or Edit */}
        {showAddForm || editingProfile ? (
          <form
            onSubmit={showAddForm ? handleSaveAdd : handleSaveEdit}
            className="max-w-md mx-auto text-left space-y-5 animate-in zoom-in-95 duration-150"
          >
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                {formError}
              </div>
            )}

            {/* Avatar & Color Preview */}
            <div className="flex items-center gap-4 p-4 rounded-2xl st-bg border st-border">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-lg"
                style={{ backgroundColor: `${formColor}22`, border: `2px solid ${formColor}` }}
              >
                {formAvatar}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold st-muted uppercase tracking-wider mb-1">
                  Avatar Seçin
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_AVATARS.map((av) => (
                    <button
                      key={av.icon}
                      type="button"
                      onClick={() => {
                        setFormAvatar(av.icon);
                        setFormColor(av.color);
                      }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition cursor-pointer ${
                        formAvatar === av.icon ? "ring-2 ring-[#FF5500] scale-110" : "hover:bg-white/10"
                      }`}
                    >
                      {av.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold st-muted uppercase tracking-wider mb-1.5">
                Profil Adı
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Örn: Can, Rabia, Misafir"
                maxLength={24}
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl st-bg border st-border st-ink text-sm focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-[#FF5500]/20 transition"
              />
            </div>

            {/* Kids Mode Toggle */}
            {(!editingProfile || !editingProfile.isMain) && (
              <label className="flex items-center gap-3 p-3.5 rounded-xl st-bg border st-border cursor-pointer hover:border-emerald-500/40 transition">
                <input
                  type="checkbox"
                  checked={formIsKid}
                  onChange={(e) => {
                    setFormIsKid(e.target.checked);
                    if (e.target.checked) {
                      setFormColor("#00C853");
                      setFormAvatar("👦");
                    }
                  }}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/30"
                />
                <div className="flex-1 text-left">
                  <div className="text-xs font-bold st-ink flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Çocuk Profili (Güvenli Mod)
                  </div>
                  <div className="text-[11px] st-muted">
                    Korku ve şiddet gibi yetişkin kategorileri gizlenir, çocuk kitapları öne çıkarılır.
                  </div>
                </div>
              </label>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {editingProfile && !editingProfile.isMain && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingProfile.id)}
                  className="px-3 py-2 rounded-xl text-red-500 hover:bg-red-500/10 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Profili Sil
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingProfile(null);
                  }}
                  className="px-4 py-2.5 rounded-xl st-bg border st-border text-xs font-bold st-muted hover:st-ink transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl st-accent-bg text-white text-xs font-bold shadow-lg shadow-[#FF5500]/25 hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Profile Cards Grid (Netflix Style) */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 justify-center max-w-2xl mx-auto mb-10">
              {profiles.map((p) => {
                const isActive = activeProfile?.id === p.id;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col items-center group cursor-pointer"
                    onClick={() => {
                      if (isManaging) {
                        openEditForm(p);
                      } else {
                        switchProfile(p.id);
                      }
                    }}
                  >
                    <div className="relative mb-3">
                      <div
                        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center text-4xl sm:text-5xl transition-all duration-200 shadow-xl ${
                          isManaging
                            ? "hover:scale-105 opacity-80 hover:opacity-100 ring-2 ring-white/30"
                            : "group-hover:scale-105 group-hover:-translate-y-1"
                        } ${isActive && !isManaging ? "ring-4 ring-[#FF5500]" : ""}`}
                        style={{
                          backgroundColor: `${p.color}22`,
                          border: `2px solid ${p.color}`,
                        }}
                      >
                        {p.avatar}
                      </div>

                      {/* Management Overlay Pencil */}
                      {isManaging && (
                        <div className="absolute inset-0 rounded-3xl bg-black/55 flex items-center justify-center text-white">
                          <Edit2 className="w-6 h-6 drop-shadow" />
                        </div>
                      )}

                      {/* Active Indicator Checkmark */}
                      {isActive && !isManaging && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full st-accent-bg text-white flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div className="text-center">
                      <div className="font-bold text-sm sm:text-base st-ink group-hover:text-[#FF5500] transition truncate max-w-[110px]">
                        {p.name}
                      </div>
                      <div className="text-[11px] font-semibold mt-0.5">
                        {p.isMain ? (
                          <span className="text-[#FF5500]">Ana Hesap</span>
                        ) : p.isKid ? (
                          <span className="text-emerald-500 font-bold">Çocuk</span>
                        ) : (
                          <span className="st-muted">Alt Hesap</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Profile Button (if < 5 profiles) */}
              {profiles.length < MAX_PROFILES && (
                <div
                  className="flex flex-col items-center group cursor-pointer"
                  onClick={openAddForm}
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border-2 border-dashed st-border flex items-center justify-center st-muted group-hover:border-[#FF5500] group-hover:text-[#FF5500] group-hover:scale-105 group-hover:-translate-y-1 transition duration-200 mb-3">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div className="text-center font-bold text-xs sm:text-sm st-muted group-hover:text-[#FF5500] transition">
                    Profil Ekle
                  </div>
                  <div className="text-[11px] st-muted">
                    {profiles.length}/{MAX_PROFILES}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsManaging(!isManaging)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                  isManaging
                    ? "st-accent-bg text-white border-transparent"
                    : "st-bg border-st-border st-muted hover:st-ink hover:border-[#FF5500]"
                }`}
              >
                {isManaging ? "Tamam" : "Profilleri Yönet"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
