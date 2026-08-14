import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Shipping Policy",
};

const sections = [
  {
    title: "Delivery Coverage",
    body: "We currently deliver across all major cities and districts in Bangladesh, including Dhaka, Chattogram, Sylhet and beyond.",
  },
  {
    title: "Delivery Timelines",
    body: "Standard delivery takes 3–5 business days inside Bangladesh. Express delivery (1–2 business days) is available for Dhaka addresses only.",
  },
  {
    title: "Shipping Fees",
    body: "Standard shipping is ৳60 and Express shipping is ৳120. Orders over ৳5,000 qualify for free standard delivery.",
  },
  {
    title: "Order Tracking",
    body: "Once your order is dispatched, you will receive a confirmation with tracking details via SMS and email.",
  },
];

export default function ShippingPolicyPage() {
  return (
    <div className="mx-auto max-w-[800px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-12 text-center">
        <SectionHeading title="Shipping Policy" />
      </div>
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 font-serif text-xl font-semibold text-green-950">
              {section.title}
            </h2>
            <p className="text-sm leading-relaxed text-brown-600">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
