import type { Metadata } from "next";
import { PaymentResult } from "@/components/checkout/PaymentResult";

export const metadata: Metadata = {
  title: "Payment Failed",
  robots: { index: false },
};

export default function PaymentFailedPage() {
  return <PaymentResult kind="failed" />;
}
