"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";

const contactDetails = [
  { icon: Phone, label: "+880 1XXX-XXXXXX" },
  { icon: Mail, label: "hello@saudiauthenticproduct.com" },
  { icon: MapPin, label: "Gulshan, Dhaka, Bangladesh" },
];

export default function ContactPage() {
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
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-4 rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
        >
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
              Name
            </label>
            <input
              required
              placeholder="Your Name"
              className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
              Email
            </label>
            <input
              required
              type="email"
              placeholder="you@example.com"
              className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
              Message
            </label>
            <textarea
              required
              rows={4}
              placeholder="How can we help?"
              className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
            />
          </div>
          <Button type="submit" variant="primary" size="lg" className="mt-2 w-full">
            Send Message
          </Button>
        </form>
      </div>
    </div>
  );
}
