"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, CreditCard, Loader2, Lock, ShieldCheck, Tag, Truck, Wallet, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { createOrder } from "@/lib/api/orders";
import { validateCoupon } from "@/lib/api/coupons";
import { createBkashPayment, getPaymentConfig } from "@/lib/api/payments";
import { getShippingSettings } from "@/lib/api/shippingSettings";
import { computeShippingFee, estimatedDeliveryDays } from "@/lib/shipping";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT, cn } from "@/lib/utils";
import { bdDistricts } from "@/data/bd-districts";
import { ProductMedia } from "@/components/ui/ProductMedia";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmailVerificationBanner } from "@/components/account/EmailVerificationBanner";
import { BKASH_PENDING_ORDER_KEY } from "./BkashCallbackClient";
import { FormSection, FieldLabel, inputClasses } from "./FormSection";
import type { ApiShippingSettings } from "@/types/api";

type DeliveryOption = "standard" | "express";
type PaymentOption = "cod" | "bkash" | "nagad";


export function CheckoutClient() {
  const { items, subtotal, clearCart } = useCart();
  const { user, status } = useAuth();
  const [delivery, setDelivery] = useState<DeliveryOption>("standard");
  const [payment, setPayment] = useState<PaymentOption>("cod");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  /** Set the moment the order is created, so a later bKash failure still knows what was placed. */
  const [placedOrder, setPlacedOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once the order exists and the browser is being handed to bKash. The
  // whole form is replaced by a "don't close this page" state, so there is
  // nothing left to click twice while the redirect is in flight.
  const [isRedirectingToBkash, setIsRedirectingToBkash] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isBkashAvailable, setIsBkashAvailable] = useState(false);
  const [shippingSettings, setShippingSettings] = useState<ApiShippingSettings | null>(null);
  // The shipping zone depends on the chosen district, so this one address
  // field has to be controlled rather than left to the uncontrolled form.
  const [district, setDistrict] = useState("");

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountBDT: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Every figure on this page is a preview only — the backend recomputes all
  // of them from the database when the order is placed, and again when the
  // payment is created, so a tampered client total buys nothing. Until the
  // rates load, shipping shows as pending rather than as a guessed number.
  const shipping = shippingSettings
    ? computeShippingFee({ deliveryMethod: delivery, district, subtotalBDT: subtotal }, shippingSettings)
    : null;
  const discount = appliedCoupon?.discountBDT ?? 0;
  const total = Math.max(0, subtotal + (shipping ?? 0) - discount);

  useEffect(() => {
    getPaymentConfig()
      .then(({ data }) => setIsBkashAvailable(data.providers.bkash))
      .catch(() => setIsBkashAvailable(false));
    getShippingSettings()
      .then(({ data }) => setShippingSettings(data.settings))
      .catch(() => setShippingSettings(null));
  }, []);

  // Derived rather than corrected after the fact: if the config request lands
  // after the customer has already picked bKash and reports the gateway as
  // unconfigured, the selection falls back to cash on delivery rather than
  // submitting an order that could never be paid.
  const selectedPayment: PaymentOption = payment === "bkash" && !isBkashAvailable ? "cod" : payment;

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
        paymentMethod: selectedPayment,
        couponCode: appliedCoupon?.code,
      });
      clearCart();
      const placed = { id: data.order._id, orderNumber: data.order.orderNumber };
      setPlacedOrder(placed);

      if (selectedPayment === "bkash") {
        await handOffToBkash(placed.id, placed.orderNumber);
        return;
      }

      setOrderNumber(placed.orderNumber);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not place your order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * The order already exists by the time this runs, so a gateway failure is
   * recoverable rather than fatal — `handoffError` drives a dedicated screen
   * below that keeps the order number in front of the customer and offers a
   * retry, instead of leaving them on a form whose cart has just been emptied.
   */
  async function handOffToBkash(orderId: string, placedOrderNumber: string) {
    setHandoffError(null);
    setIsRedirectingToBkash(true);
    try {
      const { data } = await createBkashPayment(orderId);
      // Lets the callback page offer "Retry Payment" after a failure — bKash
      // owns the return URL's query string, so it can't carry the order.
      window.sessionStorage.setItem(
        BKASH_PENDING_ORDER_KEY,
        JSON.stringify({ orderId, orderNumber: placedOrderNumber })
      );
      window.location.assign(data.payment.bkashURL);
    } catch (err) {
      setIsRedirectingToBkash(false);
      setHandoffError(
        err instanceof ApiClientError
          ? err.message
          : "We could not reach bKash just now. Please check your connection and try again."
      );
    }
  }

  if (isRedirectingToBkash) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <Loader2 size={40} className="animate-spin text-green-900" />
        <h1 className="font-serif text-3xl text-green-950">Connecting to bKash...</h1>
        <p className="text-sm text-brown-500">
          You are being taken to bKash to complete your payment of{" "}
          <span className="font-semibold text-green-950">{formatBDT(total)}</span>.
        </p>
        <p className="text-sm font-semibold text-brown-600">Please don&apos;t close this page.</p>
      </div>
    );
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

  // The order exists but bKash could not be reached. This must come before the
  // empty-cart branch below: the cart was cleared the moment the order was
  // placed, so without this the customer would be shown "Your cart is empty"
  // and lose both the error and their order number.
  if (placedOrder && handoffError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <CircleAlert size={44} className="text-gold-600" />
        <h1 className="font-serif text-3xl text-green-950">Order Placed — Payment Pending</h1>
        <p className="text-sm text-brown-500">
          Your order <span className="font-semibold text-green-950">{placedOrder.orderNumber}</span> has
          been placed and is being held for you, but we could not start the bKash payment. Nothing has
          been charged.
        </p>
        <p className="text-sm text-danger">{handoffError}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button
            variant="gold"
            size="md"
            onClick={() => handOffToBkash(placedOrder.id, placedOrder.orderNumber)}
          >
            Retry Payment
          </Button>
          <ButtonLink href="/account" variant="outline" size="md">
            View Order
          </ButtonLink>
        </div>
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

  // Both the quoted fee and the quoted lead time come from the admin-editable
  // shipping settings, so a rate or SLA change needs no deploy. `feeBDT` is
  // null until the rates have loaded.
  const deliveryOptions = (["standard", "express"] as const).map((id) => ({
    id,
    label: id === "standard" ? "Standard Delivery" : "Express Delivery",
    desc: shippingSettings
      ? `${estimatedDeliveryDays(id, shippingSettings)} business day${
          estimatedDeliveryDays(id, shippingSettings) === 1 ? "" : "s"
        }${district ? "" : " (select a district for the exact rate)"}`
      : "Loading rates...",
    feeBDT: shippingSettings
      ? computeShippingFee({ deliveryMethod: id, district, subtotalBDT: subtotal }, shippingSettings)
      : null,
  }));

  // bKash is only offered when this deployment actually has gateway
  // credentials; Nagad remains a UI-only option with no gateway behind it.
  const paymentOptions = [
    { id: "cod" as const, label: "Cash on Delivery", desc: "Pay the delivery agent when your order arrives", icon: Truck },
    ...(isBkashAvailable
      ? [
          {
            id: "bkash" as const,
            label: "bKash",
            desc: "Pay securely now through bKash mobile banking",
            icon: Wallet,
          },
        ]
      : []),
    { id: "nagad" as const, label: "Nagad", desc: "Pay on delivery via Nagad", icon: CreditCard },
  ];

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
                <select
                  required
                  name="district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className={inputClasses}
                >
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
              {deliveryOptions.map((option) => (
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
                    {option.feeBDT === null
                      ? "—"
                      : option.feeBDT === 0
                        ? "Free"
                        : formatBDT(option.feeBDT)}
                  </span>
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection title="Payment Method">
            <div className="flex flex-col gap-3">
              {paymentOptions.map((option) => (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded border p-4 transition-colors",
                    selectedPayment === option.id
                      ? "border-green-900 bg-green-950/5"
                      : "border-green-900/15 hover:border-green-900/30"
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={selectedPayment === option.id}
                    onChange={() => setPayment(option.id)}
                    className="mt-0.5 size-4 accent-green-900"
                  />
                  <option.icon size={18} className="mt-0.5 text-brown-600" />
                  <span>
                    <span className="block text-sm font-semibold text-green-950">{option.label}</span>
                    <span className="block text-xs text-brown-500">{option.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {selectedPayment === "bkash" && (
              <div className="flex items-start gap-2 rounded border border-green-900/15 bg-cream-50 p-3 text-xs text-brown-600">
                <ShieldCheck size={15} className="mt-px shrink-0 text-green-900" />
                <span>
                  You will be taken to bKash to authorise{" "}
                  <span className="font-semibold text-green-950">{formatBDT(total)}</span>. Your order is
                  only confirmed once we have verified the transaction with bKash directly.
                </span>
              </div>
            )}
          </FormSection>

          <div className="flex flex-col items-center gap-2 pt-2">
            {formError && <p className="text-sm text-danger">{formError}</p>}
            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? selectedPayment === "bkash"
                  ? "Connecting to bKash..."
                  : "Placing Order..."
                : selectedPayment === "bkash"
                  ? `Pay ${formatBDT(total)} with bKash`
                  : "Complete Order"}
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
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-brand-deep-2 text-[10px] font-bold text-white">
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
                  className="inline-flex cursor-pointer items-center justify-center rounded-full bg-danger-soft p-1 text-danger transition-colors duration-150 hover:bg-danger-soft-hover"
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
            {couponError && <p className="mt-1.5 text-xs text-danger">{couponError}</p>}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-brown-600/15 pt-4 text-sm">
            <div className="flex items-center justify-between text-brown-600">
              <span>Subtotal</span>
              <span>{formatBDT(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-brown-600">
              <span>Shipping ({delivery === "standard" ? "Standard" : "Express"})</span>
              <span>{shipping === null ? "—" : shipping === 0 ? "Free" : formatBDT(shipping)}</span>
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
