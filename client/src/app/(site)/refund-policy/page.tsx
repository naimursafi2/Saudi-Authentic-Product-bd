import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getStaticPage } from "@/lib/api/staticPages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Return & Refund Policy",
};

/**
 * Reads the admin-editable `refundPolicy` static page — same shape as
 * /shipping-policy. Nothing on this page is hardcoded: Super Admin and Admin
 * edit it from /admin/pages, and so does Co-Admin, which holds
 * `content.refundPolicy.manage` for this one page.
 */
export default async function RefundPolicyPage() {
  const { data } = await getStaticPage("refundPolicy");
  const page = data.page;
  const sections = page.blocks.filter((block) => block.isVisible);

  return (
    <div className="mx-auto max-w-[800px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-12 text-center">
        <SectionHeading title={page.heroTitle ?? "Return & Refund Policy"} />
      </div>
      {page.introText && (
        <p className="mb-10 text-center text-sm leading-relaxed text-brown-600">{page.introText}</p>
      )}
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 font-serif text-xl font-semibold text-green-950">{section.title}</h2>
            <p className="text-sm leading-relaxed text-brown-600">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
