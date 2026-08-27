import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, ChevronRight } from "lucide-react";
import { listFooterColumns } from "@/lib/api/footerColumns";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { BackToTopButton } from "@/components/layout/BackToTopButton";
import { toTelHref } from "@/lib/phone";
import type { ApiSiteSettings, SocialPlatform } from "@/types/api";

const FALLBACK_LOGO_SRC = "/images/branding/logo2.png";

/**
 * These four always render in the footer's "Follow Us" row, per the brand's
 * own request — `#` until an Admin/Super Admin sets a real URL for that
 * platform at `/admin/settings` (same graceful-placeholder convention as
 * `FooterColumn`'s `href`s before they're filled in). Any OTHER platform an
 * admin has configured (youtube/linkedin/tiktok) still appends after these,
 * using its real URL — nothing about the existing dynamic system is removed.
 */
const DEFAULT_FOOTER_SOCIAL_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "twitter", "whatsapp"];

/**
 * `settings` is passed down from the (site) layout, which already fetched it
 * once for the header/announcement bar — avoids a second, duplicate
 * site-settings round trip on every single page load.
 *
 * Deliberately a fixed deep-green/gold surface, not theme-swapped — the same
 * kind of exception Header.tsx's row-2 nav bar makes (see its own comment) —
 * the footer is meant to always read as the brand's deep green regardless of
 * the visitor's light/dark preference. The logo sits on a small cream chip
 * rather than directly on the green: `logo2.png`'s wordmark uses a dark-green
 * fill for "PRODUCT" that all but disappears against `bg-brand-deep`, so a
 * light backing plate is what keeps it legible without touching the logo
 * asset itself.
 */
export async function Footer({ settings }: { settings: ApiSiteSettings | null }) {
  // Kept at the default no-store — see the (site) layout's comment on why
  // this shared chrome intentionally isn't using `revalidate` caching.
  const { data: columnsData } = await listFooterColumns();
  const siteName = settings?.siteName || "Saudi Authentic Product";
  const footerTagline = settings?.footerTagline;
  const contactEmail = settings?.contactEmail;
  const contactPhone = settings?.contactPhone;
  const configuredSocialLinks = settings?.socialLinks ?? [];
  const socialLinkByPlatform = new Map(configuredSocialLinks.map((s) => [s.platform, s.url]));
  const footerSocialLinks = [
    ...DEFAULT_FOOTER_SOCIAL_PLATFORMS.map((platform) => ({
      platform,
      url: socialLinkByPlatform.get(platform) ?? "#",
    })),
    ...configuredSocialLinks.filter((s) => !DEFAULT_FOOTER_SOCIAL_PLATFORMS.includes(s.platform)),
  ];
  const columns = [...columnsData.footerColumns].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <footer className="bg-brand-deep text-on-brand">
      <div className="mx-auto max-w-[1200px] px-6 py-14 sm:px-10 lg:px-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          {/* Brand column */}
          <div className="flex flex-col gap-5 lg:w-72 lg:shrink-0 lg:border-r lg:border-on-brand/10 lg:pr-8">
            <Link href="/" className="inline-flex w-fit rounded-xl bg-cream-50 px-4 py-2.5">
              <Image
                src={settings?.logo?.url || FALLBACK_LOGO_SRC}
                alt={siteName}
                width={2080}
                height={756}
                className="h-9 w-auto object-contain"
              />
            </Link>

            {footerTagline && (
              <p className="max-w-xs text-sm leading-relaxed text-on-brand/75">{footerTagline}</p>
            )}

            {(contactPhone || contactEmail) && (
              <div className="flex flex-col gap-2.5 text-sm text-on-brand/80">
                {contactPhone && (
                  <a
                    href={toTelHref(contactPhone)}
                    className="flex items-center gap-2.5 transition-colors hover:text-gold-500"
                  >
                    <Phone size={15} className="shrink-0 text-gold-500" />
                    {contactPhone}
                  </a>
                )}
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-2.5 transition-colors hover:text-gold-500"
                  >
                    <Mail size={15} className="shrink-0 text-gold-500" />
                    {contactEmail}
                  </a>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-brand/55">
                Follow Us
              </span>
              <div className="flex items-center gap-2.5">
                {footerSocialLinks.map((social) => (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.platform}
                    className="flex size-9 items-center justify-center rounded-full border border-on-brand/25 text-on-brand/80 transition-all duration-200 hover:-translate-y-1 hover:border-gold-500 hover:bg-gold-500 hover:text-on-gold"
                  >
                    <SocialIcon platform={social.platform} size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Admin-managed link columns (see /admin/footer) */}
          {columns.length > 0 && (
            <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {columns.map((col) => (
                <div key={col._id}>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-on-brand">
                    {col.heading}
                  </h4>
                  <span className="mb-4 block h-0.5 w-8 rounded-full bg-gold-500" />
                  <ul className="flex flex-col gap-2.5">
                    {[...col.links]
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className="group flex items-center gap-1 text-sm text-on-brand/75 transition-colors hover:text-gold-500"
                          >
                            <ChevronRight
                              size={13}
                              className="shrink-0 text-gold-500/70 transition-transform duration-200 group-hover:translate-x-0.5"
                            />
                            {link.label}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-on-brand/10">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-on-brand/60 sm:flex-row sm:px-10 lg:px-16">
          <p>
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
          <BackToTopButton />
        </div>
      </div>
    </footer>
  );
}
