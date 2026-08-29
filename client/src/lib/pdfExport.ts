import { jsPDF } from "jspdf";
import autoTable, { type CellHook } from "jspdf-autotable";
import { downloadBlob } from "@/lib/csvExport";

/**
 * The single PDF generator used by every "Print" action project-wide (the
 * Sales Report, the Expenses monthly report, order invoices), sitting beside
 * `lib/csvExport.ts` as the other half of the same idea: one click produces a
 * finished file and downloads it, with no dialog and nothing for the user to
 * fill in.
 *
 * This deliberately does NOT use `window.print()`. The browser print flow
 * needs two dialogs (Chrome's print preview, then the OS "Save as PDF" file
 * picker) and can only *suggest* a filename, so the same click could still end
 * up saved as "document.pdf" wherever the user last saved something. These
 * documents are generated as real PDFs instead and handed to the same
 * `downloadBlob()` the CSV export uses, so a Print button behaves exactly like
 * the CSV button next to it — click, file lands in Downloads, correctly named.
 *
 * The output is drawn rather than screenshotted. Rasterizing the DOM
 * (html2canvas and friends) would have preserved the on-screen look literally,
 * but it produces blurry, unsearchable, megabyte-scale pages, and it cannot
 * read this project's Tailwind v4 palette at all — those tokens are `oklch()`
 * colors, which DOM-rasterizers do not parse. Drawing gives small files with
 * selectable text, at the cost of mirroring each layout here rather than
 * inheriting it from the page's CSS.
 */

/** A4 in points. Bangladesh (like most of the world outside North America)
 *  uses A4, and a fixed size is what makes the output identical on every
 *  machine — the old print flow inherited whatever the local printer defaulted
 *  to. 40pt margins leave a comfortable, letter-like text block. */
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

/** Plain black on white, matching the printed output's deliberate lack of
 *  decorative color — the on-screen green/brown brand palette reads as
 *  excessive ink on paper. */
const INK = "#1b1b1b";
const MUTED = "#5f5f5f";
const RULE = "#c8c8c8";

export interface PdfColumn {
  header: string;
  align?: "left" | "right" | "center";
  /** Share of the content width, 0–1. Omit to let the table size the column. */
  width?: number;
}

/**
 * jsPDF's built-in fonts are WinAnsi-encoded, so a character outside that set
 * is dropped silently — it does not throw, it just leaves a gap where the text
 * should be. Two of those turn up throughout this app's own strings:
 *
 * - The Bengali Taka sign (U+09F3) that `formatBDT()` prefixes to every
 *   amount. Embedding a Bengali-capable font would add several hundred KB to
 *   the bundle for one character, so amounts are written with the ISO currency
 *   code instead: "BDT 6,300" rather than "৳ 6,300".
 * - The typographic dashes and quotes used in labels — the Reports period line
 *   ("2026-08-01 – 2026-08-29") printed as "2026-08-01  2026-08-29", with the
 *   en dash simply missing, until these were folded to their ASCII shapes.
 *
 * Callers keep using `formatBDT()` and ordinary punctuation; every string
 * reaching the page goes through here, so nothing can slip past unconverted.
 */
export function pdfText(value: string | number): string {
  return String(value)
    .replace(/৳\s*/g, "BDT ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...");
}

/**
 * `${prefix}-${date}.pdf`, where the date is derived automatically and never
 * asked of the user. `dateContext` is the date the document is *about* and
 * defaults to today for a document that has none of its own: an invoice for a
 * January order stays that January invoice whenever it is re-downloaded, and
 * July's expense report is July's report even when generated in August.
 * Stamping today's date on those would name two different months' reports
 * identically and give one unchanging invoice a new filename every day.
 *
 * Accepts a `Date`, an ISO timestamp (an API `createdAt`), a `YYYY-MM-DD` day,
 * or a `YYYY-MM` month — a month-granular report is named by its month.
 */
export function pdfFilename(prefix: string, dateContext?: Date | string): string {
  return `${prefix}-${dateStamp(dateContext)}.pdf`;
}

function dateStamp(dateContext?: Date | string): string {
  // An already date-only string is used verbatim: `new Date("2026-08")` and
  // `new Date("2026-08-01")` parse as UTC midnight, so re-formatting them
  // through local getters shifts the stamp a day (and a `YYYY-MM` month a
  // whole month) anywhere west of Greenwich. There is also nothing to gain —
  // the string is already exactly the stamp we want.
  if (typeof dateContext === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(dateContext)) return dateContext;

  const date = dateContext ? new Date(dateContext) : new Date();
  // An unparseable value would write "NaN-NaN-NaN" into the filename; today is
  // the defensible fallback, since that is what an undated document gets.
  const resolved = Number.isNaN(date.getTime()) ? new Date() : date;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${resolved.getFullYear()}-${pad(resolved.getMonth() + 1)}-${pad(resolved.getDate())}`;
}

function newDocument(): jsPDF {
  return new jsPDF({ unit: "pt", format: "a4", compress: true });
}

/** Every generated document leaves through here, so "Print" downloads a file
 *  the same way "CSV" does — one shared `downloadBlob()`, no dialog. */
function save(doc: jsPDF, filename: string): void {
  downloadBlob(filename, doc.output("blob"));
}

function columnStyles(columns: PdfColumn[]): Record<number, { cellWidth?: number }> {
  const styles: Record<number, { cellWidth?: number }> = {};
  columns.forEach((col, i) => {
    if (col.width) styles[i] = { cellWidth: CONTENT_WIDTH * col.width };
  });
  return styles;
}

/**
 * Alignment is applied per cell rather than through `columnStyles`, which
 * autoTable only honours for body cells: a right-aligned money column came out
 * with its numbers flush right and its "Revenue" heading still flush left,
 * floating over the middle of the column. Setting it here reaches the head row
 * too, so a column's heading always sits over its own figures.
 */
function alignCells(columns: PdfColumn[]): CellHook {
  return (data) => {
    const align = columns[data.column.index]?.align;
    if (align) data.cell.styles.halign = align;
  };
}

/** The running footer, drawn on every page of every document type: a hairline,
 *  the site/contact line on the left, and the page number on the right so a
 *  multi-page report stays in order once printed. */
function drawFooter(doc: jsPDF, text: string): void {
  const y = PAGE.height - MARGIN + 12;
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y - 10, PAGE.width - MARGIN, y - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(pdfText(text), MARGIN, y);
  const page = doc.getCurrentPageInfo().pageNumber;
  doc.text(`Page ${page}`, PAGE.width - MARGIN, y, { align: "right" });
}

export interface PdfReportOptions {
  /** Filename prefix — the date and `.pdf` are appended automatically. */
  filenamePrefix: string;
  /** The date the report is *about*; defaults to today. */
  dateContext?: Date | string;
  /** Small centred banner at the top of every page. */
  bannerTitle: string;
  bannerSubtitle?: string;
  /** The document's own title, e.g. "Daily Sales Report". */
  title: string;
  /** Context lines under the title — the active filters/date range, so the
   *  file records which slice of the data it actually contains. */
  meta?: string[];
  columns: PdfColumn[];
  rows: (string | number)[][];
  /** The headline figure, set off by a rule the way the on-screen report is. */
  total?: { label: string; value: string; note?: string };
  footer: string;
}

/**
 * A tabular report — the Sales Report and the Expenses monthly report share
 * this one layout, since they are the same document shape (banner, title,
 * filter context, table, total).
 */
export function downloadReportPdf(options: PdfReportOptions): void {
  const doc = newDocument();
  let cursorY = MARGIN;

  // Banner, mirroring the on-screen report's printed header.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text(pdfText(options.bannerTitle), PAGE.width / 2, cursorY, { align: "center" });
  cursorY += 13;
  if (options.bannerSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(pdfText(options.bannerSubtitle), PAGE.width / 2, cursorY, { align: "center" });
    cursorY += 13;
  }

  cursorY += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK);
  doc.text(pdfText(options.title), MARGIN, cursorY);
  cursorY += 6;

  if (options.meta?.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    for (const line of options.meta) {
      cursorY += 12;
      doc.text(pdfText(line), MARGIN, cursorY);
    }
  }
  cursorY += 14;

  autoTable(doc, {
    startY: cursorY,
    head: [options.columns.map((c) => c.header)],
    body: options.rows.map((row) => row.map(pdfText)),
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 24 },
    // Plain rules rather than filled header bands — the same "reads as paper,
    // not as a screenshot of a card" intent the printed output had.
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 } },
    headStyles: { fontStyle: "bold", fontSize: 9, textColor: MUTED, lineWidth: { bottom: 1 }, lineColor: INK },
    bodyStyles: { lineWidth: { bottom: 0.5 }, lineColor: RULE },
    columnStyles: columnStyles(options.columns),
    didParseCell: alignCells(options.columns),
    // `rowPageBreak: "avoid"` is the drawn-PDF equivalent of the printed
    // report's `break-inside: avoid` — a row is never split across pages.
    rowPageBreak: "avoid",
    didDrawPage: () => drawFooter(doc, options.footer),
  });

  if (options.total) {
    // `lastAutoTable` is where autoTable leaves the cursor; on a table that
    // spilled onto a new page this is the position on that final page.
    const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    let totalY = afterTable + 24;

    // The total must never be orphaned onto a page of its own away from the
    // figures it sums, nor overrun the footer.
    if (totalY > PAGE.height - MARGIN - 40) {
      doc.addPage();
      drawFooter(doc, options.footer);
      totalY = MARGIN + 24;
    }

    doc.setDrawColor(INK);
    doc.setLineWidth(1);
    doc.line(MARGIN, totalY - 14, PAGE.width - MARGIN, totalY - 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK);
    doc.text(pdfText(options.total.label), MARGIN, totalY);
    doc.text(pdfText(options.total.value), PAGE.width - MARGIN, totalY, { align: "right" });
    if (options.total.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(MUTED);
      doc.text(pdfText(options.total.note), MARGIN, totalY + 14);
    }
  }

  save(doc, pdfFilename(options.filenamePrefix, options.dateContext));
}

export interface PdfInvoiceOptions {
  filenamePrefix: string;
  dateContext?: Date | string;
  siteName: string;
  orderNumber: string;
  orderDate: string;
  billedTo: string[];
  payment: string[];
  columns: PdfColumn[];
  rows: (string | number)[][];
  totals: { label: string; value: string; strong?: boolean }[];
  closingNote: string;
  footer: string;
}

/**
 * An order invoice. Structurally different enough from the reports above to
 * warrant its own layout (letterhead, billed-to/payment columns, a totals
 * block rather than a single figure), but it goes out through the same
 * generator and the same download path.
 */
export function downloadInvoicePdf(options: PdfInvoiceOptions): void {
  const doc = newDocument();
  let cursorY = MARGIN + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(pdfText(options.siteName), MARGIN, cursorY);

  doc.setFontSize(22);
  doc.text("INVOICE", PAGE.width - MARGIN, cursorY + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(pdfText(`Order #${options.orderNumber}`), PAGE.width - MARGIN, cursorY + 20, { align: "right" });
  doc.text(pdfText(options.orderDate), PAGE.width - MARGIN, cursorY + 32, { align: "right" });

  cursorY += 48;
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, cursorY, PAGE.width - MARGIN, cursorY);
  cursorY += 22;

  // Billed-to on the left, payment on the right, each block growing downward
  // independently — the table starts below whichever ran longer.
  const rightX = PAGE.width - MARGIN;
  const blockStart = cursorY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text("BILLED TO", MARGIN, blockStart);
  doc.text("PAYMENT", rightX, blockStart, { align: "right" });

  doc.setFontSize(10);
  doc.setTextColor(INK);
  let leftY = blockStart;
  options.billedTo.forEach((line, i) => {
    leftY += 14;
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    // Half the content width keeps a long address off the payment column.
    doc.text(doc.splitTextToSize(pdfText(line), CONTENT_WIDTH * 0.5), MARGIN, leftY);
    if (i === 0) doc.setFont("helvetica", "normal");
  });

  let rightY = blockStart;
  doc.setFont("helvetica", "normal");
  for (const line of options.payment) {
    rightY += 14;
    doc.text(pdfText(line), rightX, rightY, { align: "right" });
  }

  cursorY = Math.max(leftY, rightY) + 28;

  autoTable(doc, {
    startY: cursorY,
    head: [options.columns.map((c) => c.header)],
    body: options.rows.map((row) => row.map(pdfText)),
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 24 },
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 } },
    headStyles: { fontStyle: "bold", fontSize: 8, textColor: MUTED, lineWidth: { bottom: 1 }, lineColor: INK },
    bodyStyles: { lineWidth: { bottom: 0.5 }, lineColor: RULE },
    columnStyles: columnStyles(options.columns),
    didParseCell: alignCells(options.columns),
    rowPageBreak: "avoid",
    didDrawPage: () => drawFooter(doc, options.footer),
  });

  let totalsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  const totalsBlockHeight = options.totals.length * 16 + 30;
  if (totalsY + totalsBlockHeight > PAGE.height - MARGIN - 24) {
    doc.addPage();
    drawFooter(doc, options.footer);
    totalsY = MARGIN + 24;
  }

  // Right-aligned totals column, matching the on-screen invoice.
  const labelX = PAGE.width - MARGIN - 150;
  for (const row of options.totals) {
    if (row.strong) {
      doc.setDrawColor(INK);
      doc.setLineWidth(1);
      doc.line(labelX, totalsY - 10, rightX, totalsY - 10);
    }
    doc.setFont("helvetica", row.strong ? "bold" : "normal");
    doc.setFontSize(row.strong ? 12 : 10);
    doc.setTextColor(row.strong ? INK : MUTED);
    doc.text(pdfText(row.label), labelX, totalsY);
    doc.setTextColor(INK);
    doc.text(pdfText(row.value), rightX, totalsY, { align: "right" });
    totalsY += row.strong ? 20 : 16;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(pdfText(options.closingNote), PAGE.width / 2, totalsY + 26, { align: "center" });

  save(doc, pdfFilename(options.filenamePrefix, options.dateContext));
}
