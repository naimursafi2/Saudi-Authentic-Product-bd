"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api/client";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/**
 * Renders Google's official "Continue with Google" button (Google Identity
 * Services) and exchanges the resulting credential with the backend's
 * /auth/google endpoint. Renders nothing if NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * isn't set, matching this app's Cloudinary/SMTP graceful-degradation
 * pattern — see backend/.env.example for setup steps.
 */
export function GoogleAuthButton({ onError, onStart }: { onError: (message: string) => void; onStart?: () => void }) {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (window.google?.accounts?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScriptLoaded(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!CLIENT_ID || !scriptLoaded || !buttonRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response) => {
        onStart?.();
        try {
          await loginWithGoogle(response.credential);
        } catch (err) {
          onError(err instanceof ApiClientError ? err.message : "Could not sign in with Google. Please try again.");
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 320,
    });
  }, [scriptLoaded, loginWithGoogle, onError, onStart]);

  if (!CLIENT_ID) return null;

  return <div ref={buttonRef} className="flex justify-center" />;
}
