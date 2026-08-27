"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { subscribeToProductAlert } from "@/lib/api/productAlerts";
import { cn } from "@/lib/utils";
import type { ProductAlertType } from "@/types/api";

type AlertState = "idle" | "subscribing" | "subscribed" | "error";

function AlertButton({
  productId,
  variantId,
  type,
  idleLabel,
  subscribedLabel,
}: {
  productId: string;
  variantId: string;
  type: ProductAlertType;
  idleLabel: string;
  subscribedLabel: string;
}) {
  const [state, setState] = useState<AlertState>("idle");

  async function handleClick() {
    if (state !== "idle" && state !== "error") return;
    setState("subscribing");
    try {
      await subscribeToProductAlert({ productId, variantId, type });
      setState("subscribed");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "subscribing" || state === "subscribed"}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 text-xs font-semibold transition-colors",
        state === "subscribed"
          ? "cursor-default text-green-900"
          : state === "error"
            ? "text-danger hover:text-danger"
            : "text-brown-600 hover:text-gold-600"
      )}
    >
      {state === "subscribing" ? (
        <Loader2 size={14} className="animate-spin" />
      ) : state === "subscribed" ? (
        <Check size={14} />
      ) : type === "back_in_stock" ? (
        <BellRing size={14} />
      ) : (
        <Bell size={14} />
      )}
      {state === "subscribed" ? subscribedLabel : state === "error" ? "Something went wrong — try again" : idleLabel}
    </button>
  );
}

/**
 * The "Notify Me" pair on the product page — Price Drop always offered,
 * Back in Stock only once the selected variant is actually out of stock.
 * Server-scoped to the signed-in customer (`req.user.id`), so a signed-out
 * visitor gets a sign-in prompt instead, matching `ProductReviews.tsx`'s
 * convention for the same situation.
 */
export function ProductAlertButtons({
  productId,
  variantId,
  outOfStock,
}: {
  productId: string;
  variantId: string;
  outOfStock: boolean;
}) {
  const { status } = useAuth();

  if (status === "unauthenticated") {
    return (
      <p className="text-xs text-brown-600">
        <Link href="/account" className="font-semibold text-green-950 underline">
          Sign in
        </Link>{" "}
        to get notified about price drops{outOfStock ? " or when this is back in stock" : ""}.
      </p>
    );
  }

  if (status !== "authenticated") return null;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <AlertButton
        productId={productId}
        variantId={variantId}
        type="price_drop"
        idleLabel="Notify me of price drops"
        subscribedLabel="We'll email you if the price drops"
      />
      {outOfStock && (
        <AlertButton
          productId={productId}
          variantId={variantId}
          type="back_in_stock"
          idleLabel="Notify me when back in stock"
          subscribedLabel="We'll email you when it's back"
        />
      )}
    </div>
  );
}
