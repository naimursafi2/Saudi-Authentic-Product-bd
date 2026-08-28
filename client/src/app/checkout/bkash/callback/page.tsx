import type { Metadata } from "next";
import { BkashCallbackClient } from "@/components/checkout/BkashCallbackClient";

export const metadata: Metadata = {
  title: "bKash Payment",
};

export default function BkashCallbackPage() {
  return <BkashCallbackClient />;
}
