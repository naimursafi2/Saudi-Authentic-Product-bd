import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getStaticPage } from "@/lib/api/staticPages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping Policy",
};

export default async function ShippingPolicyPage() {
  const { data } = await getStaticPage("shippingPolicy");
  const page = data.page;
  const sections = page.blocks.filter((block) => block.isVisible);

  return (
    <div className="mx-auto max-w-[800px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-12 text-center">
        <SectionHeading title={page.heroTitle ?? "Shipping Policy"} />
      </div>
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
