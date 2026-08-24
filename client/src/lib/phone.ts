/**
 * `tel:`/WhatsApp link helpers for whatever number is currently on
 * `SiteSettings.contactPhone` — never a hardcoded number in a component.
 * The storefront targets Bangladesh (see CLAUDE.md), so a bare local number
 * starting with "0" is assumed to be a BD mobile number and gets "880"
 * prefixed for the international format both `tel:` and `wa.me` want; a
 * number already given with a country code passes through untouched. Shared
 * by the header's "More" menu and the product page's WhatsApp/Call buttons.
 */
export function toInternationalDigits(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  return digits;
}

export function toTelHref(rawPhone: string): string {
  const intl = toInternationalDigits(rawPhone) ?? rawPhone.replace(/\D/g, "");
  return `tel:+${intl}`;
}

export function toWhatsAppHref(rawPhone: string, message?: string): string {
  const intl = toInternationalDigits(rawPhone) ?? rawPhone.replace(/\D/g, "");
  const base = `https://wa.me/${intl}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
