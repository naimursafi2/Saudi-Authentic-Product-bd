/**
 * Shared browser-native print trigger, used by every admin "Print" action
 * (Expenses, Sales Report, ...) so there is exactly one print implementation
 * project-wide instead of a different one per page. Always opens the
 * browser's own print dialog via `window.print()` — never a direct file
 * download — so the user keeps every native browser print option (printer
 * selection, Save as PDF, color/B&W, orientation, paper size, margins).
 *
 * `document.title` becomes `${filenamePrefix}-YYYY-MM-DD` (today's date,
 * generated at click time, never hardcoded) before printing, since Chrome
 * uses the page title as the suggested filename in its print dialog /
 * "Save as PDF" destination. The title change is deferred one macrotask
 * (`setTimeout`, 100ms) before calling `window.print()` — calling both in
 * the same tick is a known Chrome race where the dialog can still read the
 * old title — then restored once the dialog has opened.
 */
export function printWithFilename(filenamePrefix: string): void {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const previousTitle = document.title;
  document.title = `${filenamePrefix}-${dateStamp}`;
  setTimeout(() => {
    window.print();
    document.title = previousTitle;
  }, 100);
}
