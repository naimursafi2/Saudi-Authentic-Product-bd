"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, LayoutPanelTop, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createHeroSlide,
  deleteHeroSlide,
  listHeroSlides,
  updateHeroSlide,
} from "@/lib/api/heroSlides";
import {
  createHomepageSection,
  deleteHomepageSection,
  listHomepageSections,
  updateHomepageSection,
} from "@/lib/api/homepageSections";
import { listCategories } from "@/lib/api/categories";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { HeroSlideForm, type HeroSlideFormValues } from "@/components/admin/HeroSlideForm";
import {
  HomepageSectionForm,
  type HomepageSectionFormValues,
} from "@/components/admin/HomepageSectionForm";
import type { ApiCategory, ApiHeroSlide, ApiHomepageSection, HomepageSectionType } from "@/types/api";

const SECTION_LABELS: Record<HomepageSectionType, string> = {
  hero: "Hero Banner",
  featuredCategories: "Featured Categories",
  bestSellers: "Best Sellers",
  productStory: "Product Story",
  customerReviews: "Customer Reviews",
  promoBanner: "Promotional Banner",
  productShowcase: "Product Showcase",
};

function heroSlideFormData(values: HeroSlideFormValues, image: File | null): FormData {
  const form = new FormData();
  form.set("title", values.title);
  form.set("subtitle", values.subtitle);
  form.set("ctaLabel", values.ctaLabel);
  form.set("ctaHref", values.ctaHref);
  form.set("sortOrder", String(values.sortOrder));
  form.set("isActive", String(values.isActive));
  if (image) form.set("image", image);
  return form;
}

function sectionFormData(values: HomepageSectionFormValues, image: File | null): FormData {
  const form = new FormData();
  form.set("title", values.title);
  form.set("subtitle", values.subtitle);
  form.set("description", values.description);
  form.set("ctaLabel", values.ctaLabel);
  form.set("ctaHref", values.ctaHref);
  form.set("sortOrder", String(values.sortOrder));
  form.set("isVisible", String(values.isVisible));
  form.set("categorySlug", values.categorySlug);
  form.set("productMode", values.productMode);
  form.set("limit", String(values.limit));
  if (image) form.set("image", image);
  return form;
}

export default function AdminHomepagePage() {
  const { user } = useAuth();
  const isRestricted = user?.role === "co_admin";

  const [slides, setSlides] = useState<ApiHeroSlide[]>([]);
  const [sections, setSections] = useState<ApiHomepageSection[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingSlide, setEditingSlide] = useState<ApiHeroSlide | "new" | null>(null);
  const [editingSection, setEditingSection] = useState<ApiHomepageSection | "new" | null>(null);
  const [newSectionType, setNewSectionType] = useState<HomepageSectionType>("promoBanner");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    Promise.all([listHeroSlides(true), listHomepageSections(true), listCategories()])
      .then(([slidesRes, sectionsRes, categoriesRes]) => {
        setSlides(slidesRes.data.slides);
        setSections(sectionsRes.data.sections);
        setCategories(categoriesRes.data.categories);
        setError(null);
      })
      .catch(() => setError("Could not load homepage content."))
      .finally(() => setIsLoading(false));
  }

  function openNewSection(type: HomepageSectionType) {
    setNewSectionType(type);
    setEditingSection("new");
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSlideSubmit(values: HeroSlideFormValues, image: File | null) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const form = heroSlideFormData(values, image);
      if (editingSlide === "new") {
        await createHeroSlide(form);
      } else if (editingSlide) {
        await updateHeroSlide(editingSlide._id, form);
      }
      setEditingSlide(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save hero slide.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSlide(slide: ApiHeroSlide) {
    if (!confirm(`Delete this hero slide? This cannot be undone.`)) return;
    await deleteHeroSlide(slide._id);
    load();
  }

  async function moveSlide(slide: ApiHeroSlide, direction: "up" | "down") {
    const sorted = [...slides].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((s) => s._id === slide._id);
    const swapWith = direction === "up" ? sorted[index - 1] : sorted[index + 1];
    if (!swapWith) return;
    await Promise.all([
      updateHeroSlide(slide._id, formDataFor({ sortOrder: swapWith.sortOrder })),
      updateHeroSlide(swapWith._id, formDataFor({ sortOrder: slide.sortOrder })),
    ]);
    load();
  }

  async function handleSectionSubmit(values: HomepageSectionFormValues, image: File | null) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const form = sectionFormData(values, image);
      if (editingSection === "new") {
        form.set("type", newSectionType);
        await createHomepageSection(form);
      } else if (editingSection) {
        await updateHomepageSection(editingSection._id, form);
      }
      setEditingSection(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save section.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSection(section: ApiHomepageSection) {
    if (!confirm(`Delete this ${SECTION_LABELS[section.type].toLowerCase()}? This cannot be undone.`)) return;
    try {
      await deleteHomepageSection(section._id);
      load();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : "Could not delete section.");
    }
  }

  async function toggleSectionVisibility(section: ApiHomepageSection) {
    await updateHomepageSection(section._id, formDataFor({ isVisible: !section.isVisible }));
    load();
  }

  async function moveSection(section: ApiHomepageSection, direction: "up" | "down") {
    const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((s) => s._id === section._id);
    const swapWith = direction === "up" ? sorted[index - 1] : sorted[index + 1];
    if (!swapWith) return;
    await Promise.all([
      updateHomepageSection(section._id, formDataFor({ sortOrder: swapWith.sortOrder })),
      updateHomepageSection(swapWith._id, formDataFor({ sortOrder: section.sortOrder })),
    ]);
    load();
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Homepage" description="Manage hero slides, sections and promotional banners." />
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Homepage" description="Manage hero slides, sections and promotional banners." />
        <ErrorState message={error} />
      </div>
    );
  }

  const sortedSlides = [...slides].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Homepage" />
        <EmptyState
          icon={LayoutPanelTop}
          title="Access restricted"
          description="Homepage content management is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader
          title="Hero Slides"
          description="The top banner's image, headline, subtitle and CTA. The first active slide (by order) is featured."
          action={
            <Button variant="primary" size="sm" onClick={() => setEditingSlide("new")}>
              <Plus size={14} /> Add Slide
            </Button>
          }
        />

        {sortedSlides.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="No hero slides yet"
            description="Add a slide to replace the default hero banner content."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                  <th className="px-4 py-3">Slide</th>
                  <th className="px-4 py-3">CTA</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedSlides.map((slide, i) => (
                  <tr key={slide._id} className="border-b border-brown-600/10 last:border-none">
                    <td className="flex items-center gap-3 px-4 py-3">
                      <span className="relative flex size-10 shrink-0 overflow-hidden rounded bg-cream-300">
                        {slide.image?.url && (
                          <Image src={slide.image.url} alt={slide.title} fill className="object-cover" />
                        )}
                      </span>
                      <span className="max-w-xs truncate font-medium text-green-950">{slide.title}</span>
                    </td>
                    <td className="px-4 py-3 text-brown-600">{slide.ctaLabel || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => moveSlide(slide, "up")}
                          className="text-brown-500 hover:text-green-950 disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          aria-label="Move down"
                          disabled={i === sortedSlides.length - 1}
                          onClick={() => moveSlide(slide, "down")}
                          className="text-brown-500 hover:text-green-950 disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={slide.isActive ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        aria-label="Edit"
                        onClick={() => setEditingSlide(slide)}
                        className="mr-3 text-brown-500 hover:text-green-950"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label="Delete"
                        onClick={() => handleDeleteSlide(slide)}
                        className="text-brown-500 hover:text-[#8a4a3f]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <PageHeader
          title="Homepage Sections"
          description="Toggle visibility, reorder, and edit content for each section. Add promo banners or product showcases as needed."
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openNewSection("productShowcase")}>
                <Plus size={14} /> Add Product Showcase
              </Button>
              <Button variant="primary" size="sm" onClick={() => openNewSection("promoBanner")}>
                <Plus size={14} /> Add Promo Banner
              </Button>
            </div>
          }
        />

        {sortedSections.length === 0 ? (
          <EmptyState icon={LayoutPanelTop} title="No sections found" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedSections.map((section, i) => (
                  <tr key={section._id} className="border-b border-brown-600/10 last:border-none">
                    <td className="px-4 py-3 font-medium text-green-950">{SECTION_LABELS[section.type]}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-brown-600">{section.title || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => moveSection(section, "up")}
                          className="text-brown-500 hover:text-green-950 disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          aria-label="Move down"
                          disabled={i === sortedSections.length - 1}
                          onClick={() => moveSection(section, "down")}
                          className="text-brown-500 hover:text-green-950 disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSectionVisibility(section)}>
                        <StatusBadge status={section.isVisible ? "active" : "inactive"} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        aria-label="Edit"
                        onClick={() => setEditingSection(section)}
                        className="mr-3 text-brown-500 hover:text-green-950"
                      >
                        <Pencil size={15} />
                      </button>
                      {(section.type === "promoBanner" || section.type === "productShowcase") && (
                        <button
                          aria-label="Delete"
                          onClick={() => handleDeleteSection(section)}
                          className="text-brown-500 hover:text-[#8a4a3f]"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingSlide && (
        <Modal title={editingSlide === "new" ? "Add Hero Slide" : "Edit Hero Slide"} onClose={() => setEditingSlide(null)}>
          <HeroSlideForm
            initial={editingSlide === "new" ? undefined : editingSlide}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSlideSubmit}
            onCancel={() => setEditingSlide(null)}
          />
        </Modal>
      )}

      {editingSection && (
        <Modal
          title={
            editingSection === "new"
              ? `Add ${SECTION_LABELS[newSectionType]}`
              : `Edit ${SECTION_LABELS[editingSection.type]}`
          }
          onClose={() => setEditingSection(null)}
        >
          <HomepageSectionForm
            type={editingSection === "new" ? newSectionType : editingSection.type}
            initial={editingSection === "new" ? undefined : editingSection}
            categories={categories}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSectionSubmit}
            onCancel={() => setEditingSection(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function formDataFor(fields: Record<string, string | number | boolean>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, String(value));
  }
  return form;
}
