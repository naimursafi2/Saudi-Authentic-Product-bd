"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { forgotPassword } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export function AuthForms() {
  const [tab, setTab] = useState<"login" | "register" | "forgot">("login");
  const { login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else if (tab === "register") {
        await register({ name, email, password, phone: phone || undefined });
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

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-6 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-serif text-3xl text-green-950">
          {tab === "login" ? "Welcome Back" : tab === "register" ? "Create Your Account" : "Reset Password"}
        </h1>
        <p className="mt-2 text-sm text-brown-500">
          {tab === "login"
            ? "Sign in to track orders and manage your wishlist."
            : tab === "register"
              ? "Join us for a faster checkout and order history."
              : "We'll email you a link to reset your password."}
        </p>
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
                "flex-1 rounded py-2 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
                tab === t ? "bg-green-900 text-white" : "text-brown-600 hover:bg-green-950/5"
              )}
            >
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>
      )}

      {tab === "forgot" && forgotSent ? (
        <div className="flex flex-col gap-4 rounded-lg border border-brown-600/10 bg-white p-6 text-center shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <p className="text-sm text-brown-600">
            If an account exists for <span className="font-semibold text-green-950">{email}</span>, a
            reset link has been sent.
          </p>
          <button
            onClick={() => {
              setTab("login");
              setForgotSent(false);
            }}
            className="text-xs font-bold uppercase tracking-[0.08em] text-green-900 underline"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
        >
          {tab === "register" && (
            <div>
              <label className={labelClasses}>Full Name</label>
              <input
                required
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldClasses}
            />
          </div>
          {tab === "register" && (
            <div>
              <label className={labelClasses}>Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1XXXXXXXXX"
                className={fieldClasses}
              />
            </div>
          )}
          {tab !== "forgot" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={cn(labelClasses, "mb-0")}>Password</label>
                {tab === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab("forgot");
                      setError(null);
                    }}
                    className="text-xs font-semibold text-brown-500 underline hover:text-green-950"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={fieldClasses}
              />
            </div>
          )}
          {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
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
              className="text-center text-xs font-bold uppercase tracking-[0.08em] text-brown-500 hover:text-green-950"
            >
              Back to Sign In
            </button>
          )}
        </form>
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
