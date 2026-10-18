import type { Metadata } from "next";
import { PaymentResult } from "@/components/checkout/PaymentResult";

export const metadata: Metadata = {
  title: "Payment Cancelled",
  robots: { index: false },
};

export default function PaymentCancelledPage() {
  return <PaymentResult kind="cancelled" />;
}
