"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, IdCard, MailCheck, Trash2, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { updateMyProfile, updateMyAvatar, removeMyAvatar, requestMyNidEdit } from "@/lib/api/users";
import { changePassword, resendVerification } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
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
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-deep text-2xl font-bold text-gold-500">
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
          className="absolute -bottom-1 -right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-cream-50 bg-gold-500 text-on-gold shadow-sm transition-colors hover:bg-gold-600 disabled:opacity-60"
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
        <p className="mt-0.5 text-xs text-brown-500">JPG or PNG, up to 2MB.</p>
        {user.avatar?.url && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isUploading}
            className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold uppercase tracking-[0.06em] text-danger transition-colors duration-150 hover:bg-danger-soft-hover disabled:opacity-60"
          >
            <Trash2 size={12} /> Remove Photo
          </button>
        )}
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
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
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-green-900">Profile updated.</p>}
      <Button type="submit" variant="primary" size="sm" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}

/**
 * Shown to every role in the shared profile page — customers, employees,
 * delivery agents, co-admins, order managers, admins and super admins all
 * verify the same way. Sends via the existing (existence-hiding, rate
 * limited) `POST /auth/resend-verification` — the viewer's own email is
 * already known here, so no separate authenticated endpoint is needed.
 */
function EmailVerificationSection({ user }: { user: ApiUser }) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setError(null);
    setIsSending(true);
    try {
      await resendVerification(user.email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send the verification email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
      <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
        <MailCheck size={18} className="text-green-900" /> Email Verification
      </h2>
      {user.isEmailVerified ? (
        <div className="flex w-fit items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-green-900">
          <CheckCircle2 size={16} /> Email Verified
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brown-600">
            <span className="font-medium text-green-950">{user.email}</span> hasn&apos;t been verified yet.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={isSending || sent}
            className="shrink-0"
          >
            {sent ? "Verification Email Sent" : isSending ? "Sending..." : "Verify Email"}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

/**
 * Read-only by design: an identity document on file is never editable by its
 * own subject. A staff member can see what is recorded for them and submit a
 * correction request, which only a Super Admin can approve — the request never
 * touches the record itself.
 */
function NidInformationSection({ user }: { user: ApiUser }) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [nidNumber, setNidNumber] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!user.staffMeta) return null;
  const { nidNumber: currentNid, nidImage } = user.staffMeta;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nidNumber.trim() && !file) {
      setError("Provide a corrected NID number, a new scan, or both.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await requestMyNidEdit({ reason: reason.trim(), nidNumber: nidNumber.trim() || undefined }, file ?? undefined);
      setSubmitted(true);
      setIsRequesting(false);
      setNidNumber("");
      setReason("");
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not submit your request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
      <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
        <IdCard size={18} className="text-green-900" /> NID Information
      </h2>
      <div className="flex items-center gap-4">
        {nidImage?.url && (
          <span className="relative block h-16 w-24 shrink-0 overflow-hidden rounded border border-green-900/15 bg-cream-50">
            <Image src={nidImage.url} alt="NID card" fill className="object-cover" />
          </span>
        )}
        <p className="text-sm text-green-950">
          NID Number: <span className="font-medium">{currentNid ?? "Not on file"}</span>
        </p>
      </div>

      <p className="mt-4 text-xs text-brown-500">
        Identity records are held by HR and cannot be edited here. Submit a correction request and a Super Admin
        will review it.
      </p>

      {submitted && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-green-900">
          <CheckCircle2 size={15} /> Request submitted — a Super Admin will review it.
        </p>
      )}

      {!isRequesting ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsRequesting(true)}>
          Request a Correction
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 border-t border-brown-600/10 pt-4">
          <div>
            <label className={labelClasses}>Corrected NID Number</label>
            <input
              value={nidNumber}
              onChange={(e) => setNidNumber(e.target.value)}
              placeholder={currentNid ?? "Not on file"}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Reason (required)</label>
            <input
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this need correcting?"
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>New NID Card Scan (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={fieldClasses}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRequesting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
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
      {error && <p className="text-sm text-danger">{error}</p>}
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
      <div className="rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
          <UserIcon size={18} className="text-green-900" /> Profile Photo
        </h2>
        <AvatarUploader user={user} />
      </div>

      <div className="rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <h2 className="mb-4 font-serif text-lg text-green-950">Personal Details</h2>
        <ProfileDetailsForm user={user} />
      </div>

      <EmailVerificationSection user={user} />

      <NidInformationSection user={user} />

      <div className="rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <h2 className="mb-4 font-serif text-lg text-green-950">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
