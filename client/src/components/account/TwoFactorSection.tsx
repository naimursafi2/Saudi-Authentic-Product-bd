"use client";

import { useState } from "react";
import Image from "next/image";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { disableTwoFactor, enableTwoFactor, startTwoFactorSetup } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { ApiUser } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export function TwoFactorSection({ user }: { user: ApiUser }) {
  const { refreshUser } = useAuth();

  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartSetup() {
    setError(null);
    setIsBusy(true);
    try {
      const { data } = await startTwoFactorSetup();
      setSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not start two-factor setup.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const { data } = await enableTwoFactor(code.trim());
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setCode("");
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not enable two-factor authentication.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await disableTwoFactor(password);
      setPassword("");
      setRecoveryCodes(null);
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not disable two-factor authentication.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg text-green-950">
        {user.twoFactorEnabled ? (
          <ShieldCheck size={18} className="text-green-900" />
        ) : (
          <ShieldOff size={18} className="text-brown-500" />
        )}
        Two-Factor Authentication
      </h2>
      <p className="mb-4 text-sm text-brown-500">
        {user.twoFactorEnabled
          ? "Your account asks for a code from your authenticator app at every sign-in."
          : "Add a second step at sign-in using an authenticator app such as Google Authenticator or Authy."}
      </p>

      {recoveryCodes && (
        <div className="mb-4 rounded-lg border border-gold-500/40 bg-[#fcf8ee] p-4">
          <p className="text-sm font-semibold text-[#735c00]">Save your recovery codes</p>
          <p className="mt-1 text-xs text-[#735c00]">
            Each code works once if you lose access to your authenticator. They are shown only now.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-green-950">
            {recoveryCodes.map((rc) => (
              <li key={rc}>{rc}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-[#8a4a3f]">{error}</p>}

      {user.twoFactorEnabled ? (
        <form onSubmit={handleDisable} className="flex flex-col gap-3">
          <div className="max-w-xs">
            <label className={labelClasses}>Confirm Password to Disable</label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              inputClassName={fieldClasses}
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="self-start" disabled={isBusy}>
            {isBusy ? "Working..." : "Disable Two-Factor"}
          </Button>
        </form>
      ) : setup ? (
        <form onSubmit={handleEnable} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-5">
            <Image
              src={setup.qrDataUrl}
              alt="Two-factor setup QR code"
              width={160}
              height={160}
              unoptimized
              className="rounded border border-brown-600/10"
            />
            <div className="text-sm text-brown-600">
              <p>Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
              <p className="mt-2 text-xs text-brown-500">
                Can&apos;t scan? Enter this key manually:
                <br />
                <span className="font-mono text-green-950">{setup.secret}</span>
              </p>
            </div>
          </div>
          <div className="max-w-[200px]">
            <label className={labelClasses}>Verification Code</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className={fieldClasses}
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="primary" size="sm" disabled={isBusy}>
              {isBusy ? "Verifying..." : "Confirm & Enable"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSetup(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="primary" size="sm" onClick={handleStartSetup} disabled={isBusy}>
          {isBusy ? "Preparing..." : "Enable Two-Factor"}
        </Button>
      )}
    </div>
  );
}
