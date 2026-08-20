export function AnnouncementBar({ text }: { text?: string | null }) {
  if (!text) return null;

  return (
    <div className="flex items-center justify-center bg-green-900 px-4 py-2 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-white">{text}</p>
    </div>
  );
}
