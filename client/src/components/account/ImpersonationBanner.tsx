"use client";

import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Always-visible reminder that the current session is a Super Admin support
 * login, not the real user. Rendered in the root layout so it can't be
 * navigated away from while the impersonation token is active.
 */
export function ImpersonationBanner() {
  const { isImpersonating, user, stopImpersonation } = useAuth();
  const router = useRouter();

  if (!isImpersonating || !user) return null;

  async function handleStop() {
    await stopImpersonation();
    router.push("/admin/customers");
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-danger-solid px-4 py-2 text-center text-xs font-semibold text-white">
      <span className="flex items-center gap-1.5">
        <UserCheck size={14} /> Support login — you are viewing the site as {user.name} ({user.email}).
      </span>
      <button onClick={handleStop} className="cursor-pointer rounded bg-white/20 px-3 py-1 uppercase tracking-[0.06em] hover:bg-white/30">
        Stop Impersonating
      </button>
    </div>
  );
}
