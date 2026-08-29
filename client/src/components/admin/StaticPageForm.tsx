"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { STATIC_PAGE_BLOCK_ICONS } from "@/lib/staticPageBlockIcons";
import type { ApiStaticPage, ApiStaticPageBlock, StaticPageBlockIcon, StaticPageType } from "@/types/api";

export interface StaticPageFormValues {
  heroTitle: string;
  heroDescription: string;
  introText: string;
  addressLine: string;
  blocks: ApiStaticPageBlock[];
  ctaTitle: string;
  ctaDescription: string;
  ctaButtonLabel: string;
  ctaButtonHref: string;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

/** Which fields are relevant for a given page type — mirrors HomepageSectionForm's per-type visibility. */
const FIELD_VISIBILITY: Record<
  StaticPageType,
  {
    heroDescription: boolean;
    heroImage: boolean;
    introText: boolean;
    addressLine: boolean;
    blocks: boolean;
    blockIcon: boolean;
    blocksLabel: string;
    cta: boolean;
  }
> = {
  about: {
    heroDescription: true,
    heroImage: true,
    introText: false,
    addressLine: false,
    blocks: true,
    blockIcon: true,
    blocksLabel: "Value Highlights",
    cta: true,
  },
  contact: {
    heroDescription: false,
    heroImage: false,
    introText: true,
    addressLine: true,
    blocks: false,
    blockIcon: false,
    blocksLabel: "",
    cta: false,
  },
  shippingPolicy: {
    heroDescription: false,
    heroImage: false,
    introText: false,
    addressLine: false,
    blocks: true,
    blockIcon: false,
    blocksLabel: "Policy Sections",
    cta: false,
  },
  // Same shape as the Shipping Policy, plus an intro paragraph — the policy
  // opens with a short summary before the numbered sections.
  refundPolicy: {
    heroDescription: false,
    heroImage: false,
    introText: true,
    addressLine: false,
    blocks: true,
    blockIcon: false,
    blocksLabel: "Policy Sections",
    cta: false,
  },
};

export function fromStaticPage(page: ApiStaticPage): StaticPageFormValues {
  return {
    heroTitle: page.heroTitle ?? "",
    heroDescription: page.heroDescription ?? "",
    introText: page.introText ?? "",
    addressLine: page.addressLine ?? "",
    blocks: page.blocks,
    ctaTitle: page.ctaTitle ?? "",
    ctaDescription: page.ctaDescription ?? "",
    ctaButtonLabel: page.ctaButtonLabel ?? "",
    ctaButtonHref: page.ctaButtonHref ?? "",
  };
}

export function StaticPageForm({
  type,
  page,
  error,
  isSubmitting,
  onSubmit,
}: {
  type: StaticPageType;
  page: ApiStaticPage;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: StaticPageFormValues, heroImage: File | null) => void;
}) {
  const [values, setValues] = useState<StaticPageFormValues>(() => fromStaticPage(page));
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const fields = FIELD_VISIBILITY[type];

  function update<K extends keyof StaticPageFormValues>(key: K, value: StaticPageFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateBlock(index: number, patch: Partial<ApiStaticPageBlock>) {
    setValues((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    }));
  }

  function addBlock() {
    setValues((prev) => ({
      ...prev,
      blocks: [...prev.blocks, { title: "", body: "", icon: fields.blockIcon ? "BadgeCheck" : undefined, isVisible: true }],
    }));
  }

  function removeBlock(index: number) {
    setValues((prev) => ({ ...prev, blocks: prev.blocks.filter((_, i) => i !== index) }));
  }

  function handleHeroImageChange(file: File | null) {
    setHeroImage(file);
    setHeroImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values, heroImage);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-brown-600/10 bg-surface p-6">
      <div>
        <label className={labelClasses}>Page Title</label>
        <input
          value={values.heroTitle}
          onChange={(e) => update("heroTitle", e.target.value)}
          className={fieldClasses}
        />
      </div>

      {fields.heroDescription && (
        <div>
          <label className={labelClasses}>
            Intro Text <span className="font-normal normal-case text-brown-500">(blank line between paragraphs)</span>
          </label>
          <textarea
            rows={6}
            value={values.heroDescription}
            onChange={(e) => update("heroDescription", e.target.value)}
            className={fieldClasses}
          />
        </div>
      )}

      {fields.introText && (
        <div>
          <label className={labelClasses}>Intro Text</label>
          <textarea
            rows={3}
            value={values.introText}
            onChange={(e) => update("introText", e.target.value)}
            className={fieldClasses}
          />
        </div>
      )}

      {fields.addressLine && (
        <div>
          <label className={labelClasses}>Address</label>
          <input
            value={values.addressLine}
            onChange={(e) => update("addressLine", e.target.value)}
            placeholder="Leave blank to hide the address row"
            className={fieldClasses}
          />
        </div>
      )}

      {fields.heroImage && (
        <div>
          <label className={labelClasses}>Hero Image (replaces existing image if selected)</label>
          <div className="flex items-center gap-4">
            <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded bg-cream-200">
              {(() => {
                const src = heroImagePreview ?? page.heroImage?.url;
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="Hero" className="size-full object-cover" />
                ) : (
                  <span className="text-xs text-brown-500">None</span>
                );
              })()}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleHeroImageChange(e.target.files?.[0] ?? null)}
              className="text-sm text-brown-600"
            />
          </div>
        </div>
      )}

      {fields.blocks && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelClasses}>{fields.blocksLabel}</label>
            <Button type="button" variant="outline" size="sm" onClick={addBlock}>
              <Plus size={12} /> Add
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {values.blocks.map((block, i) => (
              <div key={i} className="rounded border border-brown-600/10 bg-cream-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  {fields.blockIcon && (
                    <select
                      value={block.icon ?? ""}
                      onChange={(e) => updateBlock(i, { icon: e.target.value as StaticPageBlockIcon })}
                      className={fieldClasses}
                    >
                      {STATIC_PAGE_BLOCK_ICONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    required
                    value={block.title}
                    onChange={(e) => updateBlock(i, { title: e.target.value })}
                    placeholder="Title"
                    className={fieldClasses}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-brown-600">
                    <input
                      type="checkbox"
                      checked={block.isVisible}
                      onChange={(e) => updateBlock(i, { isVisible: e.target.checked })}
                      className="accent-green-900"
                    />
                    Visible
                  </label>
                  <Tooltip label="Remove">
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeBlock(i)}
                      className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-delete p-1.5 text-white transition-colors duration-200 ease-in-out hover:bg-delete-hover"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Tooltip>
                </div>
                <textarea
                  required
                  rows={2}
                  value={block.body}
                  onChange={(e) => updateBlock(i, { body: e.target.value })}
                  placeholder="Body text"
                  className={fieldClasses}
                />
              </div>
            ))}
            {values.blocks.length === 0 && (
              <p className="text-xs text-brown-500">None yet — add one above.</p>
            )}
          </div>
        </div>
      )}

      {fields.cta && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClasses}>CTA Title</label>
            <input
              value={values.ctaTitle}
              onChange={(e) => update("ctaTitle", e.target.value)}
              placeholder="Leave blank to hide the closing banner"
              className={fieldClasses}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClasses}>CTA Description</label>
            <textarea
              rows={2}
              value={values.ctaDescription}
              onChange={(e) => update("ctaDescription", e.target.value)}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>CTA Button Label</label>
            <input
              value={values.ctaButtonLabel}
              onChange={(e) => update("ctaButtonLabel", e.target.value)}
              placeholder="Shop Now"
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>CTA Button Link</label>
            <input
              value={values.ctaButtonHref}
              onChange={(e) => update("ctaButtonHref", e.target.value)}
              placeholder="/shop"
              className={fieldClasses}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end border-t border-brown-600/10 pt-4">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Page"}
        </Button>
      </div>
    </form>
  );
}
