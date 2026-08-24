import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "FAQs",
};

/**
 * A plain static page, same family as /about and /shipping-policy but not
 * wired into the `StaticPage` admin content system — that system is a
 * deliberately fixed three-type enum (about/contact/shippingPolicy, see
 * CLAUDE.md's "Static page content management"), and adding a fourth,
 * admin-editable type wasn't part of what was asked for here. Content below
 * is a reasonable starting set for a Bangladesh-facing Saudi goods
 * storefront; edit in place if it needs to change.
 */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "Are your products genuinely imported from Saudi Arabia?",
    answer:
      "Yes. Every product is sourced directly from Saudi Arabia and Madinah, with authenticity badges shown on the product page wherever it applies.",
  },
  {
    question: "Which areas in Bangladesh do you deliver to?",
    answer:
      "We deliver across Bangladesh. Shipping cost and delivery time depend on the district you select at checkout.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "Cash on Delivery, bKash and Nagad are available at checkout. Card/online payment gateways are not yet supported.",
  },
  {
    question: "How can I track my order?",
    answer:
      "Use the Track Order page with your order number and the email used at checkout, or check My Orders from your account dashboard if you're signed in.",
  },
  {
    question: "What is your return and refund policy?",
    answer:
      "If an order arrives damaged, incorrect, or not as described, you can request a refund from your account's order history once the order is marked as returned. Our team reviews every request before it's approved.",
  },
  {
    question: "How do I get in touch with support?",
    answer:
      "Use the Call Us or WhatsApp options in the navbar's More menu, or visit the Contact page for our email and address.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-[800px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-12 text-center">
        <SectionHeading title="Frequently Asked Questions" />
      </div>
      <div className="flex flex-col gap-3">
        {FAQS.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-lg border border-brown-600/10 bg-surface px-5 py-4 open:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-base font-semibold text-green-950 sm:text-lg">
              {faq.question}
              <span className="shrink-0 text-xl leading-none text-gold-600 transition-transform duration-200 ease-in-out group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-brown-600">{faq.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
