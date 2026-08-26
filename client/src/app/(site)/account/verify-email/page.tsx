"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MailWarning, XCircle } from "lucide-react";
import { verifyEmail, resendVerification } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button, ButtonLink } from "@/components/ui/Button";

type State = "verifying" | "verified" | "already-verified" | "expired" | "invalid" | "missing-token";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";

function ResendForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    try {
      await resendVerification(email);
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-green-900">
        If an account exists for that email, a new verification link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={fieldClasses}
      />
      <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Resend Verification Email"}
      </Button>
    </form>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<State>(token ? "verifying" : "missing-token");
  const ranOnce = useRef(false);
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (!token || ranOnce.current) return;
    ranOnce.current = true;

    verifyEmail(token)
      .then(({ data }) => {
        setState(data.status === "already-verified" ? "already-verified" : "verified");
        // In case the browser verifying the link is also signed in as this
        // user (e.g. opened the email in the same session), refresh the
        // cached user so the profile page's badge flips immediately instead
        // of waiting for the next navigation.
        void refreshUser();
      })
      .catch((err) => {
        const message = err instanceof ApiClientError ? err.message.toLowerCase() : "";
        setState(message.includes("expired") ? "expired" : "invalid");
      });
  }, [token, refreshUser]);

  const wrapperClasses = "mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center";

  if (state === "missing-token") {
    return (
      <div className={wrapperClasses}>
        <XCircle size={44} className="text-brown-500/60" />
        <h1 className="font-serif text-3xl text-green-950">Invalid Link</h1>
        <p className="text-sm text-brown-500">
          This verification link is missing its token. Please request a new one below.
        </p>
        <ResendForm />
      </div>
    );
  }

  if (state === "verifying") {
    return (
      <div className={wrapperClasses}>
        <div className="size-10 animate-pulse rounded-full bg-green-900/20" />
        <p className="text-sm text-brown-500">Verifying your email...</p>
      </div>
    );
  }

  if (state === "verified" || state === "already-verified") {
    return (
      <div className={wrapperClasses}>
        <CheckCircle2 size={44} className="text-green-900" />
        <h1 className="font-serif text-3xl text-green-950">
          {state === "verified" ? "Email Verified" : "Already Verified"}
        </h1>
        <p className="text-sm text-brown-500">
          {state === "verified"
            ? "Your email address has been confirmed. You now have full access to your account."
            : "This email address was already verified — you're all set."}
        </p>
        <ButtonLink href="/account" variant="primary" size="md" className="mt-2">
          Go to Dashboard
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      <MailWarning size={44} className="text-danger" />
      <h1 className="font-serif text-3xl text-green-950">
        {state === "expired" ? "Link Expired" : "Invalid Link"}
      </h1>
      <p className="text-sm text-brown-500">
        {state === "expired"
          ? "This verification link has expired. Enter your email below to get a new one."
          : "This verification link is invalid. Enter your email below to get a new one."}
      </p>
      <ResendForm />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
