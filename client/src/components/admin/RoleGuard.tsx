"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types/api";

/** Blocks rendering until the current user's role is confirmed to be in `allowed`. */
export function RoleGuard({ allowed, children }: { allowed: Role[]; children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/account");
    else if (status === "authenticated" && user && !allowed.includes(user.role)) router.replace("/account");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user]);

  if (status === "loading" || status === "unauthenticated" || !user || !allowed.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="size-8 animate-pulse rounded-full bg-green-900/20" />
      </div>
    );
  }

  return <>{children}</>;
}
