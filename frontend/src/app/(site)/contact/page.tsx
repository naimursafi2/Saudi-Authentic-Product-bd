import { Mail, MapPin, Phone } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContactForm } from "@/components/contact/ContactForm";
import { getSiteSettings } from "@/lib/api/siteSettings";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { data } = await getSiteSettings();
  const { contactEmail, contactPhone } = data.settings;

  const contactDetails = [
    contactPhone ? { icon: Phone, label: contactPhone } : null,
    contactEmail ? { icon: Mail, label: contactEmail } : null,
    { icon: MapPin, label: "Gulshan, Dhaka, Bangladesh" },
  ].filter((detail): detail is { icon: typeof Phone; label: string } => detail !== null);

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-12 text-center">
        <SectionHeading title="Contact Us" />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <p className="text-sm leading-relaxed text-brown-600">
            Have a question about an order, a product, or a partnership? We&apos;d love
            to hear from you.
          </p>
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
