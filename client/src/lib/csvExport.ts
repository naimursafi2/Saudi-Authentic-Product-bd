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
 * `downloadCsv` below and `pdfExport.ts`, so every file this app hands the
 * user leaves through one implementation.
 *
 * A fresh object URL is minted per call and never reused, so two downloads
 * cannot serve each other's bytes. The revoke is deferred rather than run in
 * the same tick as `click()`: the click only *queues* the download, and
 * revoking the URL synchronously can pull the blob out from under a browser
 * that has not started reading it yet, which truncates or drops the file
 * while the on-screen preview still looks right. A macrotask is enough for
 * the download to be committed, and the URL is still released so the blob
 * can be garbage-collected. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  const csv = lines.join("\r\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}
