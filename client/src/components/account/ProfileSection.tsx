"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { updateMyProfile, updateMyAvatar, removeMyAvatar } from "@/lib/api/users";
import { changePassword } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { TwoFactorSection } from "@/components/account/TwoFactorSection";
import type { ApiUser } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none disabled:opacity-60";
const labelClasses = "mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function AvatarUploader({ user }: { user: ApiUser }) {
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      await updateMyAvatar(file);
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update your photo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setIsUploading(true);
    try {
      await removeMyAvatar();
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not remove your photo.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-950 text-2xl font-bold text-gold-500">
          {user.avatar?.url ? (
            <Image src={user.avatar.url} alt={user.name} width={80} height={80} className="size-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </span>
        <button
          type="button"
          aria-label="Change profile picture"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute -bottom-1 -right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-cream-50 bg-gold-500 text-green-950 shadow-sm transition-colors hover:bg-gold-600 disabled:opacity-60"
        >
          <Camera size={14} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-green-950">{isUploading ? "Uploading…" : "Profile Photo"}</p>
        <p className="mt-0.5 text-xs text-brown-500">JPG or PNG, up to 5MB.</p>
        {user.avatar?.url && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isUploading}
            className="mt-1.5 flex cursor-pointer items-center gap-1 text-xs font-bold uppercase tracking-[0.06em] text-brown-500 hover:text-[#8a4a3f] disabled:opacity-60"
          >
            <Trash2 size={12} /> Remove Photo
          </button>
        )}
        {error && <p className="mt-1.5 text-xs text-[#8a4a3f]">{error}</p>}
      </div>
    </div>
  );
}

function ProfileDetailsForm({ user }: { user: ApiUser }) {
  const { refreshUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      await updateMyProfile({ name: name.trim(), phone: phone.trim() || undefined });
      await refreshUser();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update your profile.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Full Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+880 1XXXXXXXXX"
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Email Address</label>
          <input value={user.email} disabled className={fieldClasses} />
        </div>
        <div>
          <label className={labelClasses}>Member Since</label>
          <input
            disabled
            value={new Date(user.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            className={fieldClasses}
          />
        </div>
      </div>
      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}
      {success && <p className="text-sm text-green-900">Profile updated.</p>}
      <Button type="submit" variant="primary" size="sm" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update your password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Current Password</label>
          <PasswordInput
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            inputClassName={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>New Password</label>
          <PasswordInput
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            inputClassName={fieldClasses}
          />
        </div>
      </div>
      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}
      {success && <p className="text-sm text-green-900">Password updated.</p>}
      <Button type="submit" variant="outline" size="sm" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}

export function ProfileSection({ user }: { user: ApiUser }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
          <UserIcon size={18} className="text-green-900" /> Profile Photo
        </h2>
        <AvatarUploader user={user} />
      </div>

      <div className="rounded-xl border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <h2 className="mb-4 font-serif text-lg text-green-950">Personal Details</h2>
        <ProfileDetailsForm user={user} />
      </div>

      <div className="rounded-xl border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <h2 className="mb-4 font-serif text-lg text-green-950">Change Password</h2>
        <ChangePasswordForm />
      </div>

      <TwoFactorSection user={user} />
    </div>
  );
}
