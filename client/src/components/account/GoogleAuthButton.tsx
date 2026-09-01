"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api/client";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    use_fedcm_for_prompt?: boolean;
    use_fedcm_for_button?: boolean;
  }) => void;
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
export function GoogleAuthButton({
  onError,
  onStart,
  onFinish,
}: {
  onError: (message: string) => void;
  onStart?: () => void;
  /**
   * Fires after the credential exchange settles either way (success or
   * failure). Lets the caller clear a "Signing in..." state — without this,
   * clicking the button gave zero visual feedback while `loginWithGoogle`
   * was in flight, which on a slow/cold backend response reads as "the
   * button doesn't work" even though it's just quietly waiting.
   */
  onFinish?: () => void;
}) {
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

  // Kept in a ref so the initialize/renderButton effect below depends only on
  // the script being ready. Callers pass inline arrow functions (e.g.
  // onStart={() => setError(null)}), which are new on every render — depending
  // on them directly re-ran google.accounts.id.initialize() on each render and
  // GIS warned that only the last instance would be used.
  const handlersRef = useRef({ onError, onStart, onFinish });
  useEffect(() => {
    handlersRef.current = { onError, onStart, onFinish };
  }, [onError, onStart, onFinish]);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      handlersRef.current.onStart?.();
      try {
        await loginWithGoogle(response.credential);
      } catch (err) {
        handlersRef.current.onError(
          err instanceof ApiClientError ? err.message : "Could not sign in with Google. Please try again."
        );
      } finally {
        handlersRef.current.onFinish?.();
      }
    },
    [loginWithGoogle]
  );

  // GIS only accepts a fixed pixel width (no percentage), so the button would
  // otherwise sit at one hardcoded size and overflow or under-fill the card it
  // is dropped into. Measuring the wrapper keeps it flush with the form's own
  // submit button on every screen size. Google clamps `width` to 200-400px.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const measure = () => setWidth(Math.round(wrapper.getBoundingClientRect().width));
    measure();
    // Observing the wrapper rather than the render target avoids a feedback
    // loop — the iframe GIS injects can never widen its own container.
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!CLIENT_ID || !scriptLoaded || !buttonRef.current || !window.google || !width) return;

    // Without FedCM, Chrome falls back to a classic OAuth popup
    // (accounts.google.com/o/oauth2/v2/auth?...&display=popup) whenever
    // third-party cookies are blocked for this site. That popup frequently
    // gets silently blocked by the browser — GIS logs a
    // "Failed to open popup window... Maybe blocked by the browser?" console
    // error and the click does nothing visible, which reads as "the button
    // doesn't work" with zero on-page feedback. FedCM is the browser-native
    // replacement that doesn't rely on third-party cookies or a popup at all.
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredential,
      use_fedcm_for_prompt: true,
      use_fedcm_for_button: true,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: Math.min(400, Math.max(200, width)),
    });
  }, [scriptLoaded, handleCredential, width]);

  if (!CLIENT_ID) return null;

  return (
    <div ref={wrapperRef} className="w-full">
      <div ref={buttonRef} className="flex justify-center" />
    </div>
  );
}
