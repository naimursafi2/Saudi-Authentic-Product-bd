"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, LogIn, MapPin, Plus, UserPlus, X } from "lucide-react";
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
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

type Tab = "login" | "register" | "forgot";

const HEADER: Record<Tab, { icon: typeof LogIn; title: string; subtitle: string }> = {
  login: { icon: LogIn, title: "Welcome Back", subtitle: "Sign in to track orders and manage your wishlist." },
  register: {
    icon: UserPlus,
    title: "Create Your Account",
    subtitle: "Register to get started — a faster checkout and order history await.",
  },
  forgot: { icon: KeyRound, title: "Reset Password", subtitle: "We'll email you a link to reset your password." },
};

export function AuthForms() {
  const [tab, setTab] = useState<Tab>("login");
  const { login, register } = useAuth();

  // Shared / login+register fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Optional address, register only
  const [showAddress, setShowAddress] = useState(false);
  const [fullAddress, setFullAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [cityArea, setCityArea] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const passwordsMismatch = tab === "register" && confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (tab === "register") {
      if (!meetsPasswordRequirements(password)) {
        setError("Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (showAddress && !phone) {
        setError("Add a phone number above to save your delivery address.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else if (tab === "register") {
        await register({
          name,
          email,
          password,
          confirmPassword,
          phone: phone || undefined,
          address: showAddress && fullAddress && district && cityArea ? { fullAddress, district, cityArea } : undefined,
        });
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

  const Header = HEADER[tab];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-6 py-16 sm:py-24">
      <div className="text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-green-950 text-gold-500">
          <Header.icon size={24} />
        </span>
        <h1 className="font-serif text-3xl text-green-950">{Header.title}</h1>
        <p className="mt-2 text-sm text-brown-500">{Header.subtitle}</p>
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
              <label className={labelClasses}>Phone {showAddress ? "" : "(optional)"}</label>
              <input
                required={showAddress}
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
              <PasswordInput
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                inputClassName={fieldClasses}
              />
              {tab === "register" && <PasswordStrengthMeter password={password} />}
            </div>
          )}
          {tab === "register" && (
            <div>
              <label className={labelClasses}>Confirm Password</label>
              <PasswordInput
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                inputClassName={cn(fieldClasses, passwordsMismatch && "border-[#8a4a3f]/50")}
              />
              {passwordsMismatch && <p className="mt-1 text-xs text-[#8a4a3f]">Passwords do not match.</p>}
            </div>
          )}

          {tab === "register" &&
            (showAddress ? (
              <div className="flex flex-col gap-3 rounded-lg border border-brown-600/10 bg-cream-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
                    <MapPin size={13} /> Delivery Address
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddress(false);
                      setFullAddress("");
                      setDistrict("");
                      setCityArea("");
                    }}
                    aria-label="Remove address"
                    className="text-brown-500 hover:text-[#8a4a3f]"
                  >
                    <X size={14} />
                  </button>
                </div>
                <input
                  required
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  placeholder="House, Road, Area"
                  className={fieldClasses}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="District"
                    className={fieldClasses}
                  />
                  <input
                    required
                    value={cityArea}
                    onChange={(e) => setCityArea(e.target.value)}
                    placeholder="City / Area"
                    className={fieldClasses}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddress(true)}
                className="flex items-center gap-1.5 self-start text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
              >
                <Plus size={13} /> Add delivery address (optional)
              </button>
            ))}

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

          {tab !== "forgot" && GOOGLE_SIGN_IN_ENABLED && (
            <>
              <div className="flex items-center gap-3 pt-1">
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
