import type { Metadata } from "next";
import { PaymentResult } from "@/components/checkout/PaymentResult";

export const metadata: Metadata = {
  title: "Payment Successful",
  robots: { index: false },
};

export default function PaymentSuccessPage() {
  return <PaymentResult kind="success" />;
}
