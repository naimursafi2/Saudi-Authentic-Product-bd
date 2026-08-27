/**
 * Hand-rolled CSV export — no library needed for comma-joined rows (see
 * CLAUDE.md's Known Limitations note on report exports). Generates the CSV
 * from data already fetched for display and triggers a browser download via
 * a Blob URL; nothing is sent to the server.
 */
function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Triggers a browser download of an already-fetched/generated Blob via a
 * synthetic `<a download>` click — the filename is fully controlled here,
 * client-side, regardless of what content-type the blob is. Shared by
 * `downloadCsv` below and any other "download this file" action (e.g. a
 * server-generated PDF) so there's one implementation of the boilerplate. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  const csv = lines.join("\r\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}
