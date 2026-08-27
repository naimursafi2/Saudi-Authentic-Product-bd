import PDFDocument from "pdfkit";
import type { SalesGroupBy } from "./report.service";

const GROUP_BY_LABEL: Record<SalesGroupBy, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

export interface SalesReportPdfInput {
  groupBy: SalesGroupBy;
  from?: Date;
  to?: Date;
  timeSeries: { period: string; revenueBDT: number; orders: number }[];
  siteName: string;
  contactEmail?: string;
  contactPhone?: string;
}

function formatBDT(amount: number): string {
  return `BDT ${amount.toLocaleString("en-US")}`;
}

/**
 * Renders the Daily/Weekly/Monthly Sales Report as a real PDF file —
 * generated server-side with `pdfkit` (a lightweight, pure-Node drawing
 * library — no headless-browser dependency, appropriate for a
 * structured/tabular report rather than a pixel copy of a web page) rather
 * than relying on the browser's own print-to-PDF, which hands off to the
 * OS print spooler and a Windows driver ("Microsoft Print to PDF") that no
 * webpage can control or name. Mirrors the on-screen print report's
 * structure — company header + report date, title, period line,
 * Period/Revenue/Orders table, footer — with the same 0.75in margin on
 * every side (54pt ≈ 0.75in at PDF's 72pt/inch).
 */
export function renderSalesReportPdf(input: SalesReportPdfInput, destination: NodeJS.WritableStream): void {
  const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true });
  // Pipe attached before any content is drawn/before `.end()` is called —
  // pdfkit's own recommended order, so the stream is flowing (not just
  // internally buffering) as content is generated.
  doc.pipe(destination);
  const reportLabel = GROUP_BY_LABEL[input.groupBy];
  const contact = input.contactEmail || input.contactPhone;
  const todayLabel = new Date().toLocaleDateString();

  // Title + period line
  doc.font("Helvetica-Bold").fontSize(16).text(`${reportLabel} Sales Report`);
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#555")
    .text(
      `Period: ${input.from ? input.from.toLocaleDateString() : "Earliest order"} – ${
        input.to ? input.to.toLocaleDateString() : "Latest order"
      }`
    );
  doc.fillColor("#000").moveDown(1);

  // Table
  const columns = [
    { label: "Period", width: 160 },
    { label: "Revenue", width: 160 },
    { label: "Orders", width: 160 },
  ];
  const tableLeft = doc.page.margins.left;
  let y = doc.y;

  function drawRow(cells: string[], opts: { bold?: boolean; ruleBelow?: boolean } = {}) {
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    let x = tableLeft;
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i], x, y, { width: columns[i].width, lineBreak: false });
      x += columns[i].width;
    }
    y += 20;
    if (opts.ruleBelow) {
      doc
        .moveTo(tableLeft, y - 4)
        .lineTo(tableLeft + columns.reduce((s, c) => s + c.width, 0), y - 4)
        .strokeColor("#ccc")
        .stroke();
    }
  }

  drawRow(
    columns.map((c) => c.label.toUpperCase()),
    { bold: true, ruleBelow: true }
  );

  if (input.timeSeries.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#555").text("No sales in this range.", tableLeft, y);
  } else {
    for (const row of input.timeSeries) {
      // A plain, manually-triggered page break — deliberately NOT relying on
      // pdfkit's own automatic pagination (see the header/footer comment
      // below for why that path is unsafe to combine with this report).
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      drawRow([row.period, formatBDT(row.revenueBDT), String(row.orders)]);
    }
  }

  // Running header/footer, stamped onto every already-laid-out page —
  // pdfkit's own documented pattern for repeating content (see its "Adding
  // headers and footers" recipe), and the *only* safe way to do this. Doing
  // this reactively via a `doc.on("pageAdded", ...)` listener instead (drawing
  // while pdfkit is still in the middle of laying out text) was tried and
  // caused actual infinite recursion: a listener-drawn header positioned
  // above the top margin can itself be judged by pdfkit's internal line
  // wrapper as needing "continued on a new page", which fires `addPage()`
  // again from inside the very listener already handling that event,
  // recursing until the call stack overflows. `bufferPages: true` defers
  // finalizing each page so it can still be revisited here, after the
  // entire page count is already known, with no risk of triggering more
  // pagination mid-draw.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const { left, right, top, bottom } = doc.page.margins;
    const width = doc.page.width - left - right;

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#000")
      .text(input.siteName, left, top - 40, { width, align: "center", lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#555")
      .text(`Report date: ${todayLabel}`, left, top - 24, { width, align: "center", lineBreak: false });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#555")
      .text(`${input.siteName}${contact ? ` · ${contact}` : ""}`, left, doc.page.height - bottom + 10, {
        width,
        align: "center",
        lineBreak: false,
      });
    doc.fillColor("#000");
  }

  doc.end();
}
