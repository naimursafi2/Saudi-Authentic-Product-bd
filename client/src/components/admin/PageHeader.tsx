export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-2xl text-green-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-brown-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
