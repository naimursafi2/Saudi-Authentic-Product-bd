"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Colors the confirm button — "danger" for delete/reject/other irreversible
   * actions, "primary" for everything else. */
  tone?: "danger" | "primary";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

/**
 * App-wide replacement for `window.confirm()` — a styled modal consistent
 * with the rest of the admin UI, so cancelling reads unambiguously as
 * "nothing happened" the same way it does everywhere else in the app.
 * Mounted once at the root layout; call `useConfirm()` from any page.
 */
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirmDialog = useCallback<ConfirmFn>((opts) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  function settle(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }

  return (
    <ConfirmDialogContext.Provider value={confirmDialog}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            aria-label="Cancel"
            className="absolute inset-0 cursor-pointer bg-green-950/40"
            onClick={() => settle(false)}
          />
          <div className="relative w-full max-w-sm rounded-lg bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              {options.tone === "danger" && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <TriangleAlert size={18} />
                </span>
              )}
              <div>
                <h2 className="font-serif text-lg text-green-950">{options.title}</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-brown-600">{options.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                {options.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={options.tone === "danger" ? "danger" : "primary"}
                size="sm"
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  return ctx;
}
