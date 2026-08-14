import Link from "next/link";
import { Globe, Mail } from "lucide-react";

const linkColumns = [
  {
    heading: "Explore",
    links: [
      { href: "/about", label: "Our Story" },
      { href: "/shop?category=madinah-dates", label: "Madinah Dates" },
      { href: "/categories", label: "Premium Perfumes" },
    ],
  },
  {
    heading: "Support",
    links: [
      { href: "/shipping-policy", label: "Shipping Policy" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-cream-200">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 border-t border-brown-600/10 bg-cream-300 px-6 py-12 sm:flex-row sm:justify-between sm:px-16">
        <div className="flex flex-1 flex-col gap-4">
          <h3 className="font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] text-green-950 sm:text-[40px]">
            Saudi
            <br />
            Authentic
            <br />
            Product
          </h3>
          <p className="max-w-[220px] text-xs font-bold uppercase tracking-[0.1em] text-brown-500">
            © {new Date().getFullYear()} Saudi Authentic Product. Crafted for the
            discerning collector.
          </p>
        </div>

        {linkColumns.map((col) => (
          <div key={col.heading} className="flex-1">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-brown-600">
              {col.heading}
            </h4>
            <ul className="flex flex-col gap-3">
              {col.links.map((link) => (
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
        <p>© {new Date().getFullYear()} Saudi Authentic Product. Bringing Saudi heritage to Bangladesh.</p>
        <div className="flex items-center gap-4">
          <a href="#" aria-label="Website" className="hover:text-green-950">
            <Globe size={16} />
          </a>
          <a href="mailto:hello@saudiauthenticproduct.com" aria-label="Email" className="hover:text-green-950">
            <Mail size={16} />
          </a>
        </div>
      </div>
    </footer>
  );
}
