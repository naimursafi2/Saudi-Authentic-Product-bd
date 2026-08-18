"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { resendVerification } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setError(null);
    setIsSending(true);
    try {
      await resendVerification(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not resend the verification email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gold-600/30 bg-gold-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MailWarning size={20} className="mt-0.5 shrink-0 text-gold-700" />
        <div>
          <p className="text-sm font-semibold text-green-950">Please verify your email address</p>
          <p className="mt-0.5 text-xs text-brown-600">
            Check <span className="font-medium">{email}</span> for a verification link. You&apos;ll need to
            verify before placing orders or posting reviews.
          </p>
          {error && <p className="mt-1 text-xs text-[#8a4a3f]">{error}</p>}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={isSending || sent}
        className="shrink-0"
      >
        {sent ? "Email sent" : isSending ? "Sending..." : "Resend Email"}
      </Button>
    </div>
  );
}
