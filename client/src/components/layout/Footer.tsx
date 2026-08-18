import Link from "next/link";
import { Mail } from "lucide-react";
import { getSiteSettings } from "@/lib/api/siteSettings";
import { listFooterColumns } from "@/lib/api/footerColumns";
import { SocialIcon } from "@/components/ui/SocialIcon";

export async function Footer() {
  const [{ data: settingsData }, { data: columnsData }] = await Promise.all([
    getSiteSettings(),
    listFooterColumns(),
  ]);
  const { siteName, footerTagline, contactEmail, socialLinks } = settingsData.settings;
  const columns = [...columnsData.footerColumns].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <footer className="bg-cream-200">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 border-t border-brown-600/10 bg-cream-300 px-6 py-12 sm:flex-row sm:justify-between sm:px-16">
        <div className="flex flex-1 flex-col gap-4">
          <h3 className="max-w-[260px] font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] text-green-950 sm:text-[40px]">
            {siteName}
          </h3>
          {footerTagline && (
            <p className="max-w-[220px] text-xs font-bold uppercase tracking-[0.1em] text-brown-500">
              {footerTagline}
            </p>
          )}
        </div>

        {columns.map((col) => (
          <div key={col._id} className="flex-1">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-brown-600">
              {col.heading}
            </h4>
            <ul className="flex flex-col gap-3">
              {[...col.links].sort((a, b) => a.sortOrder - b.sortOrder).map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-xs font-bold uppercase tracking-[0.1em] text-brown-600 hover:text-green-950"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-brown-500 sm:flex-row sm:px-16">
        <p>
          © {new Date().getFullYear()} {siteName}
          {footerTagline ? `. ${footerTagline}` : ""}
        </p>
        <div className="flex items-center gap-4">
          {socialLinks.map((social) => (
            <a
              key={social.platform}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.platform}
              className="hover:text-green-950"
            >
              <SocialIcon platform={social.platform} size={16} />
            </a>
          ))}
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} aria-label="Email" className="hover:text-green-950">
              <Mail size={16} />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
