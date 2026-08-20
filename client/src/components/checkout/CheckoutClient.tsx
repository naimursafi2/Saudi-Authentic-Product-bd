"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Lock, ShieldCheck, Tag, Truck, Wallet, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { createOrder } from "@/lib/api/orders";
import { validateCoupon } from "@/lib/api/coupons";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT, cn } from "@/lib/utils";
import { bdDistricts } from "@/data/bd-districts";
import { ProductMedia } from "@/components/ui/ProductMedia";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmailVerificationBanner } from "@/components/account/EmailVerificationBanner";
import { FormSection, FieldLabel, inputClasses } from "./FormSection";

type DeliveryOption = "standard" | "express";
type PaymentOption = "cod" | "bkash" | "nagad";

const DELIVERY_FEES: Record<DeliveryOption, number> = {
  standard: 60,
  express: 120,
};

export function CheckoutClient() {
  const { items, subtotal, clearCart } = useCart();
  const { user, status } = useAuth();
  const [delivery, setDelivery] = useState<DeliveryOption>("standard");
  const [payment, setPayment] = useState<PaymentOption>("cod");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountBDT: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const shipping = DELIVERY_FEES[delivery];
  const discount = appliedCoupon?.discountBDT ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError(null);
    setIsApplyingCoupon(true);
    try {
      const { data } = await validateCoupon(code, subtotal);
      setAppliedCoupon({ code: data.code, discountBDT: data.discountBDT });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof ApiClientError ? err.message : "Could not apply this coupon.");
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = new FormData(e.currentTarget);
    setIsSubmitting(true);
    try {
      const { data } = await createOrder({
        items: items.map((item) => ({
          productId: item.product.id,
          variantId: item.variant.id,
          quantity: item.quantity,
        })),
        shippingAddress: {
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          fullAddress: String(form.get("fullAddress") ?? ""),
          district: String(form.get("district") ?? ""),
          cityArea: String(form.get("cityArea") ?? ""),
        },
        deliveryMethod: delivery,
        paymentMethod: payment,
        couponCode: appliedCoupon?.code,
      });
      setOrderNumber(data.order.orderNumber);
      clearCart();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not place your order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (orderNumber) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <ShieldCheck size={44} className="text-green-900" />
        <h1 className="font-serif text-3xl text-green-950">Order Confirmed</h1>
        <p className="text-sm text-brown-500">
          Thank you for your order. Your confirmation number is{" "}
          <span className="font-semibold text-green-950">{orderNumber}</span>. A
          confirmation email is on its way to you.
        </p>
        <ButtonLink href="/shop" variant="primary" size="md" className="mt-2">
          Continue Shopping
        </ButtonLink>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <Lock size={36} className="text-brown-500/60" />
        <h1 className="font-serif text-3xl text-green-950">Sign in to check out</h1>
        <p className="text-sm text-brown-500">
          Please sign in or create an account to complete your order.
        </p>
        <ButtonLink href="/account" variant="primary" size="md" className="mt-2">
          Sign In
        </ButtonLink>
      </div>
    );
  }

  if (user && !user.isEmailVerified) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmailVerificationBanner email={user.email} />
        <p className="text-center text-sm text-brown-500">
          Verify your email address to complete checkout, then come back to place your order.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-green-950">Your cart is empty</h1>
        <p className="text-sm text-brown-500">
          Add a few authentic Saudi products before heading to checkout.
        </p>
        <ButtonLink href="/shop" variant="primary" size="md" className="mt-2">
          Browse Products
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10 lg:py-14">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <FormSection title="Customer Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Email Address *</FieldLabel>
                <input
                  required
                  name="email"
                  type="email"
                  defaultValue={user?.email}
                  placeholder="you@example.com"
                  className={inputClasses}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Phone Number (BD) *</FieldLabel>
                <input
                  required
                  name="phone"
                  type="tel"
                  pattern="\+?880?1[0-9]{9}"
                  defaultValue={user?.phone}
                  placeholder="+880 1XXXXXXXXX"
                  className={inputClasses}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Shipping Address">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>First Name *</FieldLabel>
                <input
                  required
                  name="firstName"
                  defaultValue={user?.name?.split(" ")[0]}
                  placeholder="First Name"
                  className={inputClasses}
                />
              </div>
              <div>
                <FieldLabel>Last Name *</FieldLabel>
                <input
                  required
                  name="lastName"
                  defaultValue={user?.name?.split(" ").slice(1).join(" ")}
                  placeholder="Last Name"
                  className={inputClasses}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Full Address (House/Road) *</FieldLabel>
                <input
                  required
                  name="fullAddress"
                  placeholder="e.g. House 12, Road 5, Block D"
                  className={inputClasses}
                />
              </div>
              <div>
                <FieldLabel>District *</FieldLabel>
                <select required name="district" defaultValue="" className={inputClasses}>
                  <option value="" disabled>
                    Select District
                  </option>
                  {bdDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>City / Area *</FieldLabel>
                <input
                  required
                  name="cityArea"
                  placeholder="e.g. Gulshan, Dhanmondi"
                  className={inputClasses}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Delivery Method">
            <div className="flex flex-col gap-3">
              {(
                [
                  {
                    id: "standard" as const,
                    label: "Standard Delivery",
                    desc: "3–5 Business Days (Inside BD)",
                  },
                  {
                    id: "express" as const,
                    label: "Express Delivery",
                    desc: "1–2 Business Days (Dhaka Only)",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded border p-4 transition-colors",
                    delivery === option.id
                      ? "border-green-900 bg-green-950/5"
                      : "border-green-900/15 hover:border-green-900/30"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="delivery"
                      checked={delivery === option.id}
                      onChange={() => setDelivery(option.id)}
                      className="size-4 accent-green-900"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-green-950">
                        {option.label}
                      </span>
                      <span className="block text-xs text-brown-500">{option.desc}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-green-950">
                    {formatBDT(DELIVERY_FEES[option.id])}
                  </span>
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection title="Payment Method">
            <div className="flex flex-col gap-3">
              {(
                [
                  { id: "cod" as const, label: "Cash on Delivery", icon: Truck },
                  { id: "bkash" as const, label: "bKash (Mobile Banking)", icon: Wallet },
                  { id: "nagad" as const, label: "Nagad (Mobile Banking)", icon: CreditCard },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded border p-4 transition-colors",
                    payment === option.id
                      ? "border-green-900 bg-green-950/5"
                      : "border-green-900/15 hover:border-green-900/30"
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === option.id}
                    onChange={() => setPayment(option.id)}
                    className="size-4 accent-green-900"
                  />
                  <option.icon size={18} className="text-brown-600" />
                  <span className="text-sm font-semibold text-green-950">{option.label}</span>
                </label>
              ))}
            </div>
          </FormSection>

          <div className="flex flex-col items-center gap-2 pt-2">
            {formError && <p className="text-sm text-[#8a4a3f]">{formError}</p>}
            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Placing Order..." : "Complete Order"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-brown-500">
              <Lock size={12} /> Secure Checkout Process
            </p>
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-brown-600/10 bg-cream-300 p-6">
          <h2 className="mb-4 font-serif text-lg font-semibold text-green-950">
            Order Summary
          </h2>
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li key={`${item.product.id}-${item.variant.id}`} className="flex gap-3">
                <span className="relative size-14 shrink-0 overflow-hidden rounded">
                  <ProductMedia
                    src={item.product.images[0]?.url}
                    fallbackPhoto={item.product.fallbackPhoto}
                    visual={item.product.visual}
                    alt={item.product.name}
                    sizes="56px"
                    pattern={false}
                  />
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-green-900 text-[10px] font-bold text-white">
                    {item.quantity}
                  </span>
                </span>
                <span className="flex-1">
                  <Link
                    href={`/product/${item.product.slug}`}
                    className="block text-sm font-semibold text-green-950 hover:text-green-900"
                  >
                    {item.product.name}
                  </Link>
                  <span className="block text-xs text-brown-500">{item.variant.label}</span>
                  <span className="block text-sm font-semibold text-green-950">
                    {formatBDT(item.lineTotal)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-brown-600/15 pt-4">
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded border border-green-900/20 bg-green-950/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-green-950">
                  <Tag size={14} /> {appliedCoupon.code}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  aria-label="Remove coupon"
                  className="cursor-pointer text-brown-500 hover:text-green-950"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Coupon code"
                  className={cn(inputClasses, "flex-1")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyCoupon}
                  disabled={isApplyingCoupon || !couponInput.trim()}
                >
                  {isApplyingCoupon ? "Applying..." : "Apply"}
                </Button>
              </div>
            )}
            {couponError && <p className="mt-1.5 text-xs text-[#8a4a3f]">{couponError}</p>}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-brown-600/15 pt-4 text-sm">
            <div className="flex items-center justify-between text-brown-600">
              <span>Subtotal</span>
              <span>{formatBDT(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-brown-600">
              <span>Shipping ({delivery === "standard" ? "Standard" : "Express"})</span>
              <span>{formatBDT(shipping)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-green-900">
                <span>Discount ({appliedCoupon?.code})</span>
                <span>-{formatBDT(discount)}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-brown-600/15 pt-4">
            <span className="font-serif text-lg text-green-950">Total</span>
            <span className="font-serif text-xl font-semibold text-green-950">
              {formatBDT(total)}
            </span>
          </div>
        </aside>
      </div>
    </form>
  );
}
