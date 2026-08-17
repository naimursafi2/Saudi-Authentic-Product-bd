import { Mail, MapPin, Phone } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContactForm } from "@/components/contact/ContactForm";
import { getSiteSettings } from "@/lib/api/siteSettings";
import { getStaticPage } from "@/lib/api/staticPages";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const [{ data: settingsData }, { data: pageData }] = await Promise.all([
    getSiteSettings(),
    getStaticPage("contact"),
  ]);
  const { contactEmail, contactPhone } = settingsData.settings;
  const page = pageData.page;

  const contactDetails = [
    contactPhone ? { icon: Phone, label: contactPhone } : null,
    contactEmail ? { icon: Mail, label: contactEmail } : null,
    page.addressLine ? { icon: MapPin, label: page.addressLine } : null,
  ].filter((detail): detail is { icon: typeof Phone; label: string } => detail !== null);

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-12 text-center">
        <SectionHeading title={page.heroTitle ?? "Contact Us"} />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {page.introText && (
            <p className="text-sm leading-relaxed text-brown-600">{page.introText}</p>
          )}
          <ul className="flex flex-col gap-4">
            {contactDetails.map((detail) => (
              <li key={detail.label} className="flex items-center gap-3 text-sm text-green-950">
                <detail.icon size={18} className="text-green-900" />
                {detail.label}
              </li>
            ))}
          </ul>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
