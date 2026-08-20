/**
 * The thin strip above the main navbar (e.g. "Eid Mubarak — free delivery
 * this week"). Hidden by default: it renders only when an Admin/Super Admin
 * has switched `announcementEnabled` on at `/admin/settings` AND left some
 * text in `announcementText`. The blank-text guard means clearing the text
 * hides the strip too, so an empty green bar can never ship.
 */
export function AnnouncementBar({ enabled, text }: { enabled?: boolean; text?: string | null }) {
  if (!enabled || !text?.trim()) return null;

  return (
    <div className="flex items-center justify-center bg-brand-deep-2 px-4 py-2 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-white">{text}</p>
    </div>
  );
}
