"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { GoogleAuthButton } from "@/components/account/GoogleAuthButton";
import { useAuth } from "@/context/AuthContext";
import { forgotPassword } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";
import { meetsPasswordRequirements } from "@/lib/passwordStrength";

const GOOGLE_SIGN_IN_ENABLED = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-brown-600";

type Tab = "login" | "register" | "forgot";

const HEADER: Record<Tab, { icon: typeof LogIn; title: string; subtitle: string }> = {
  login: { icon: LogIn, title: "Welcome Back", subtitle: "Sign in to track orders and manage your wishlist." },
  register: {
    icon: UserPlus,
    title: "Create Your Account",
    subtitle: "Takes less than a minute — then checkout is one tap.",
  },
  forgot: { icon: KeyRound, title: "Reset Password", subtitle: "We'll email you a link to reset your password." },
};

export function AuthForms() {
  const searchParams = useSearchParams();
  // Lets the navbar's "Sign Up" link (/account?tab=register) open straight
  // into the register step instead of always landing on login.
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "register" ? "register" : "login");
  const { login, register, completeTwoFactorLogin } = useAuth();

  // Set once the password step succeeds on a 2FA-enabled account — the form
  // then swaps to the code-entry step until it's cleared.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Shared / login+register fields. Registration is deliberately limited to
  // the four fields the account itself needs: a phone number and a delivery
  // address are collected later, in the account Address Book and at checkout,
  // so signing up stays one short screen.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const passwordsMismatch = tab === "register" && confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (tab === "register") {
      if (!meetsPasswordRequirements(password)) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (tab === "login") {
        const outcome = await login(email, password);
        if ("challengeToken" in outcome) {
          setChallengeToken(outcome.challengeToken);
        }
      } else if (tab === "register") {
        await register({ name, email, password, confirmPassword });
      } else {
        await forgotPassword(email);
        setForgotSent(true);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTwoFactorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await completeTwoFactorLogin(challengeToken, twoFactorCode.trim());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function cancelTwoFactor() {
    setChallengeToken(null);
    setTwoFactorCode("");
    setPassword("");
    setError(null);
  }

  if (challengeToken) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-5 px-5 py-12 sm:py-16">
        <div className="text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-brand-deep text-gold-500">
            <ShieldCheck size={20} />
          </span>
          <h1 className="font-serif text-2xl text-green-950">Two-Step Verification</h1>
          <p className="mt-1.5 text-sm text-brown-500">
            Enter the 6-digit code from your authenticator app, or one of your recovery codes.
          </p>
        </div>

        <form
          onSubmit={handleTwoFactorSubmit}
          className="flex flex-col gap-3.5 rounded-lg border border-brown-600/10 bg-surface p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
        >
          <div>
            <label className={labelClasses}>Authentication Code</label>
            <input
              required
              autoFocus
              autoComplete="one-time-code"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder="123456"
              className={cn(fieldClasses, "text-center text-lg tracking-[0.3em]")}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Verifying..." : "Verify & Sign In"}
          </Button>
          <button
            type="button"
            onClick={cancelTwoFactor}
            className="cursor-pointer text-center text-xs font-bold uppercase tracking-[0.08em] text-brown-500 hover:text-green-950"
          >
            Back to Sign In
          </button>
        </form>
      </div>
    );
  }

  const Header = HEADER[tab];

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 px-5 py-12 sm:py-16">
      <div className="text-center">
        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-brand-deep text-gold-500">
          <Header.icon size={20} />
        </span>
        <h1 className="font-serif text-2xl text-green-950">{Header.title}</h1>
        <p className="mt-1.5 text-sm text-brown-500">{Header.subtitle}</p>
      </div>

      {tab !== "forgot" && (
        <div className="flex rounded border border-green-900/15 p-1">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={cn(
                "flex-1 cursor-pointer rounded py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
                tab === t ? "bg-brand-deep-2 text-white" : "text-brown-600 hover:bg-green-950/5"
              )}
            >
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>
      )}

      {tab === "forgot" && forgotSent ? (
        <div className="flex flex-col gap-3.5 rounded-lg border border-brown-600/10 bg-surface p-5 text-center shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <p className="text-sm text-brown-600">
            If an account exists for <span className="font-semibold text-green-950">{email}</span>, a
            reset link has been sent.
          </p>
          <button
            onClick={() => {
              setTab("login");
              setForgotSent(false);
            }}
            className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-green-900 underline"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3.5 rounded-lg border border-brown-600/10 bg-surface p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
        >
          {tab === "register" && (
            <div>
              <label className={labelClasses}>Full Name</label>
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className={fieldClasses}
              />
            </div>
          )}
          <div>
            <label className={labelClasses}>Email Address</label>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldClasses}
            />
          </div>
          {/* Register puts the two password fields side by side from `sm` up so
              the whole form stays one short screen; on mobile the grid
              collapses back to a single column. */}
          {tab !== "forgot" && (
            <div className={cn(tab === "register" && "grid items-start gap-3.5 sm:grid-cols-2")}>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className={cn(labelClasses, "mb-0")}>Password</label>
                  {tab === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab("forgot");
                        setError(null);
                      }}
                      className="cursor-pointer text-xs font-semibold text-brown-500 underline hover:text-green-950"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <PasswordInput
                  required
                  minLength={8}
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  inputClassName={fieldClasses}
                />
                {tab === "register" && <PasswordStrengthMeter password={password} />}
              </div>
              {tab === "register" && (
                <div>
                  <label className={labelClasses}>Confirm Password</label>
                  <PasswordInput
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    inputClassName={cn(fieldClasses, passwordsMismatch && "border-danger/50")}
                  />
                  {passwordsMismatch && <p className="mt-1 text-xs text-danger">Passwords do not match.</p>}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" className="mt-0.5 w-full" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : tab === "login"
                ? "Sign In"
                : tab === "register"
                  ? "Create Account"
                  : "Send Reset Link"}
          </Button>
          {tab === "forgot" && (
            <button
              type="button"
              onClick={() => setTab("login")}
              className="cursor-pointer text-center text-xs font-bold uppercase tracking-[0.08em] text-brown-500 hover:text-green-950"
            >
              Back to Sign In
            </button>
          )}

          {tab !== "forgot" && GOOGLE_SIGN_IN_ENABLED && (
            <>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-brown-600/10" />
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-brown-500">
                  or continue with
                </span>
                <span className="h-px flex-1 bg-brown-600/10" />
              </div>
              <GoogleAuthButton onError={setError} onStart={() => setError(null)} />
            </>
          )}
        </form>
      )}

      {/* The header has a single "Sign In" action and no separate Sign Up
          button, so this is the primary route into registration (the tab bar
          above is the other). Mirrored for the reverse direction so someone
          who lands on Register can get back to signing in. */}
      {tab !== "forgot" && (
        <p className="text-center text-sm text-brown-500">
          {tab === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setTab(tab === "login" ? "register" : "login");
              setError(null);
            }}
            className="cursor-pointer font-bold text-green-950 underline underline-offset-2 hover:text-gold-600"
          >
            {tab === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      )}

      {tab !== "forgot" && (
        <p className="text-center text-xs text-brown-500">
          By continuing you agree to our{" "}
          <Link href="/shipping-policy" className="underline hover:text-green-950">
            policies
          </Link>
          .
        </p>
      )}
    </div>
  );
}
