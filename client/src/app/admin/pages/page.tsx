"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { listStaticPages, updateStaticPage } from "@/lib/api/staticPages";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StaticPageForm, type StaticPageFormValues } from "@/components/admin/StaticPageForm";
import type { ApiStaticPage, StaticPageType } from "@/types/api";

const PAGE_LABELS: Record<StaticPageType, string> = {
  about: "About",
  contact: "Contact",
  shippingPolicy: "Shipping Policy",
  refundPolicy: "Return & Refund Policy",
};

const PAGE_TYPES: StaticPageType[] = ["about", "contact", "shippingPolicy", "refundPolicy"];

export default function AdminStaticPagesPage() {
  const { hasPermission } = useAuth();
  const canManageAllPages = hasPermission("content.pages.manage");
  const canManageRefundPolicy = canManageAllPages || hasPermission("content.refundPolicy.manage");
  const isRestricted = !canManageAllPages && !canManageRefundPolicy;

  // Co-Admin holds `content.refundPolicy.manage` and nothing wider, so it sees
  // only that one tab. The server enforces the same rule in
  // staticPage.service.ts — this just avoids offering a tab that would 403.
  const editableTypes: StaticPageType[] = canManageAllPages ? PAGE_TYPES : ["refundPolicy"];

  const [pages, setPages] = useState<ApiStaticPage[]>([]);
  const [activeType, setActiveType] = useState<StaticPageType>(
    canManageAllPages ? "about" : "refundPolicy"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listStaticPages()
      .then(({ data }) => {
        setPages(data.pages);
        setError(null);
      })
      .catch(() => setError("Could not load pages."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(values: StaticPageFormValues, heroImage: File | null) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.set("heroTitle", values.heroTitle);
      form.set("heroDescription", values.heroDescription);
      form.set("introText", values.introText);
      form.set("addressLine", values.addressLine);
      form.set("blocks", JSON.stringify(values.blocks));
      form.set("ctaTitle", values.ctaTitle);
      form.set("ctaDescription", values.ctaDescription);
      form.set("ctaButtonLabel", values.ctaButtonLabel);
      form.set("ctaButtonHref", values.ctaButtonHref);
      if (heroImage) form.set("heroImage", heroImage);
      const { data } = await updateStaticPage(activeType, form);
      setPages((prev) => prev.map((p) => (p.type === activeType ? data.page : p)));
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save page.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Pages" />
        <EmptyState
          icon={FileText}
          title="Access restricted"
          description="Static page content is available to Admin, Super Admin and (for the Return & Refund Policy) Co-Admin."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Pages" description="Edit the About, Contact, Shipping Policy and Return & Refund Policy pages." />
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Pages" description="Edit the About, Contact, Shipping Policy and Return & Refund Policy pages." />
        <ErrorState message={error} />
      </div>
    );
  }

  const activePage = pages.find((p) => p.type === activeType);

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Edit the About, Contact, Shipping Policy and Return & Refund Policy pages. Contact details (phone/email/social) are managed under Settings."
      />

      <div className="mb-6 flex gap-1 border-b border-brown-600/10">
        {editableTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeType === type
                ? "border-green-900 text-green-950"
                : "border-transparent text-brown-500 hover:text-green-950"
            }`}
          >
            {PAGE_LABELS[type]}
          </button>
        ))}
      </div>

      {activePage ? (
        <StaticPageForm
          key={activePage.type}
          type={activePage.type}
          page={activePage}
          error={formError}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      ) : (
        <ErrorState message="Page not found." />
      )}
    </div>
  );
}
