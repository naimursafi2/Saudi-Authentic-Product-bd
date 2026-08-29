import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getStaticPage } from "@/lib/api/staticPages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQs",
};

/**
 * General storefront FAQs. The return/refund entry is deliberately NOT here:
 * that content is admin-editable and lives on the `refundPolicy` static page,
 * so it is fetched below and rendered from the database. Hardcoding it here
 * would give the site two sources of truth for the same policy, and the
 * admin-panel copy would silently stop matching what customers read.
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
    question: "How do I get in touch with support?",
    answer:
      "Use the Call Us or WhatsApp options in the navbar's More menu, or visit the Contact page for our email and address.",
  },
];

export default async function FaqPage() {
  // The return/refund answers come from the admin-editable Return & Refund
  // Policy page, so an edit made in the admin panel shows up here too. If the
  // API is unreachable the general FAQs still render — the policy questions
  // are simply omitted rather than falling back to a stale hardcoded copy.
  const refundPolicy = await getStaticPage("refundPolicy")
    .then(({ data }) => data.page)
    .catch(() => null);

  const policyFaqs = (refundPolicy?.blocks ?? [])
    .filter((block) => block.isVisible)
    .map((block) => ({ question: block.title, answer: block.body }));

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

      {policyFaqs.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-serif text-xl font-semibold text-green-950">
            {refundPolicy?.heroTitle ?? "Return & Refund Policy"}
          </h2>
          {refundPolicy?.introText && (
            <p className="mb-4 text-sm leading-relaxed text-brown-600">{refundPolicy.introText}</p>
          )}
          <div className="flex flex-col gap-3">
            {policyFaqs.map((faq) => (
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
          <Link
            href="/refund-policy"
            className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
          >
            Read the full policy
          </Link>
        </section>
      )}
    </div>
  );
}
