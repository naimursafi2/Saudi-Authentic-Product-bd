/**
 * A visible hover/focus tooltip for icon-only buttons — pairs with, never
 * replaces, `aria-label` (screen readers still need that; this is purely
 * the sighted-user affordance). Pure CSS reveal via `group-hover`/
 * `group-focus-within`, no JS state.
 */
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-green-950 px-2 py-1 text-[11px] font-medium text-cream-50 opacity-0 shadow-md transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
