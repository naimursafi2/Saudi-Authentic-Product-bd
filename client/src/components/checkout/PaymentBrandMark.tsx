/**
 * Brand marks for the mobile-banking payment options at checkout.
 *
 * Drawn inline as SVG rather than loaded as images: the checkout page must not
 * depend on a remote asset to render its payment selector, and these sit next
 * to lucide icons at the same optical size. Each is a rounded tile in the
 * provider's own brand colour with its wordmark — recognisable next to the
 * option label without reproducing a copyrighted logo artwork.
 *
 * The brand colours are deliberately literal here rather than design tokens:
 * they identify a third party and must not flip with the light/dark theme, the
 * same reasoning as the CONSTANT `--color-action-*` families in globals.css.
 */

const BKASH_PINK = "#E2136E";
const NAGAD_ORANGE = "#F7941D";

function BrandTile({
  label,
  background,
  title,
}: {
  label: string;
  background: string;
  title: string;
}) {
  return (
    <svg
      width="34"
      height="22"
      viewBox="0 0 34 22"
      role="img"
      aria-label={title}
      className="shrink-0"
    >
      <title>{title}</title>
      <rect width="34" height="22" rx="4" fill={background} />
      <text
        x="17"
        y="15"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        letterSpacing="0.2"
      >
        {label}
      </text>
    </svg>
  );
}

export function BkashMark() {
  return <BrandTile label="bKash" background={BKASH_PINK} title="bKash" />;
}

export function NagadMark() {
  return <BrandTile label="Nagad" background={NAGAD_ORANGE} title="Nagad" />;
}
