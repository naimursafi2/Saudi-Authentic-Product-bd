"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { resetPassword } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { meetsPasswordRequirements } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!meetsPasswordRequirements(password)) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password, confirmPassword);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not reset your password. The link may have expired — please request a new one."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-green-950">Invalid Link</h1>
        <p className="text-sm text-brown-500">
          This password reset link is missing its token. Please request a new one.
        </p>
        <ButtonLink href="/account" variant="primary" size="md">
          Back to Sign In
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-green-950">Password Reset</h1>
        <p className="text-sm text-brown-500">You can now sign in with your new password.</p>
        <Button variant="primary" size="md" onClick={() => router.push("/account")}>
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-6 py-16 sm:py-24">
      <div className="text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-deep text-gold-500">
          <KeyRound size={24} />
        </span>
        <h1 className="font-serif text-3xl text-green-950">Set a New Password</h1>
        <p className="mt-2 text-sm text-brown-500">Choose a strong password you haven&apos;t used before.</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
      >
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
            New Password
          </label>
          <PasswordInput
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            inputClassName={fieldClasses}
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
            Confirm New Password
          </label>
          <PasswordInput
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            inputClassName={cn(fieldClasses, passwordsMismatch && "border-danger/50")}
          />
          {passwordsMismatch && <p className="mt-1 text-xs text-danger">Passwords do not match.</p>}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
