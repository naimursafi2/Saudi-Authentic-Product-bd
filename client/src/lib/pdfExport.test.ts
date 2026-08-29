import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadInvoicePdf, downloadReportPdf, pdfFilename, pdfText } from "./pdfExport";
import { downloadBlob } from "./csvExport";

vi.mock("./csvExport", () => ({ downloadBlob: vi.fn() }));

/**
 * The single PDF generator behind every "Print" action project-wide. What is
 * pinned here is what is easy to break and silently wrong in production: the
 * file must download on its own (no print dialog, no Save As), it must be
 * named automatically from the document's own date, and the Bengali Taka sign
 * must not reach a PDF font that cannot draw it.
 */
describe("pdfExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 9, 14, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("pdfFilename", () => {
    it("stamps today's date on a document that has none of its own", () => {
      expect(pdfFilename("Sales-Report")).toBe("Sales-Report-2026-03-09.pdf");
    });

    it("zero-pads single-digit months and days so filenames sort correctly", () => {
      vi.setSystemTime(new Date(2026, 0, 5));
      expect(pdfFilename("Sales-Report")).toBe("Sales-Report-2026-01-05.pdf");
    });

    it("names a document by its own date rather than today's", () => {
      // Otherwise one unchanging invoice gets a new filename every day it is
      // re-downloaded.
      expect(pdfFilename("Invoice-SAP-20260101-1234", "2026-01-01T09:15:00.000Z")).toBe(
        "Invoice-SAP-20260101-1234-2026-01-01.pdf"
      );
    });

    it("keeps a month-granular report on its own month", () => {
      // Not expanded to an arbitrary day inside July, and not shifted into June
      // by a UTC-midnight reparse — and, crucially, July's report and August's
      // no longer collide on one filename.
      expect(pdfFilename("Expense-Report", "2026-07")).toBe("Expense-Report-2026-07.pdf");
      expect(pdfFilename("Expense-Report", "2026-08")).toBe("Expense-Report-2026-08.pdf");
    });

    it("accepts a Date", () => {
      expect(pdfFilename("Invoice", new Date(2025, 10, 3))).toBe("Invoice-2025-11-03.pdf");
    });

    it("falls back to today rather than writing NaN into the filename", () => {
      expect(pdfFilename("Invoice", "not-a-date")).toBe("Invoice-2026-03-09.pdf");
    });
  });

  describe("pdfText", () => {
    it("replaces the Taka sign with the ISO code the PDF fonts can draw", () => {
      // jsPDF's built-in fonts are WinAnsi-encoded and have no U+09F3, so an
      // unconverted amount would render blank or as a stray glyph.
      expect(pdfText("৳ 19,270")).toBe("BDT 19,270");
      expect(pdfText("-৳ 200")).toBe("-BDT 200");
    });

    it("leaves ordinary text and numbers alone", () => {
      expect(pdfText("Daily Sales Report")).toBe("Daily Sales Report");
      expect(pdfText(42)).toBe("42");
    });
  });

  describe("downloadReportPdf", () => {
    const options = {
      filenamePrefix: "Sales-Report",
      bannerTitle: "Saudi Authentic Product",
      bannerSubtitle: "Report date: 09/03/2026",
      title: "Daily Sales Report",
      meta: ["Period: 2026-08-01 – 2026-08-29"],
      columns: [{ header: "Period" }, { header: "Revenue", align: "right" as const }, { header: "Orders" }],
      rows: [["2026-08-14", "৳ 1,260", 1]],
      total: { label: "Total Revenue", value: "৳ 19,270", note: "4 orders in this period" },
      footer: "Saudi Authentic Product",
    };

    it("downloads a real PDF straight away, with no dialog in between", async () => {
      downloadReportPdf(options);

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0];
      expect(filename).toBe("Sales-Report-2026-03-09.pdf");
      // A genuine PDF, not an HTML or text stand-in: readers key off the magic
      // number, so a file that fails this would not open at all.
      const header = new Uint8Array(await (blob as Blob).arrayBuffer()).subarray(0, 5);
      expect(String.fromCharCode(...header)).toBe("%PDF-");
    });

    it("still produces a file for an empty result set", () => {
      // A filtered range with no sales must download an empty report rather
      // than throwing and leaving the click doing nothing at all.
      expect(() => downloadReportPdf({ ...options, rows: [], total: undefined })).not.toThrow();
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });

    it("paginates a long report instead of truncating it", async () => {
      const rows = Array.from({ length: 120 }, (_, i) => [`2026-08-${i}`, "৳ 1,000", 1]);
      downloadReportPdf({ ...options, rows });

      const [, blob] = vi.mocked(downloadBlob).mock.calls[0];
      const text = await (blob as Blob).text();
      // More than one page object means the overflowing rows carried onto
      // further pages rather than being dropped off the bottom of page one.
      expect(text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0).toBeGreaterThan(1);
    });
  });

  describe("downloadInvoicePdf", () => {
    it("downloads an invoice named after the order, dated by the order", async () => {
      downloadInvoicePdf({
        filenamePrefix: "Invoice-SAP-20260101-1234",
        dateContext: "2026-01-01T00:00:00.000Z",
        siteName: "Saudi Authentic Product",
        orderNumber: "SAP-20260101-1234",
        orderDate: "1 January 2026",
        billedTo: ["Jane Doe", "jane@example.com"],
        payment: ["Method: Cash on Delivery", "Status: Unpaid"],
        columns: [{ header: "Product" }, { header: "Total", align: "right" }],
        rows: [["Ajwa Dates (500g)", "৳ 2,400"]],
        totals: [
          { label: "Subtotal", value: "৳ 2,400" },
          { label: "Total", value: "৳ 2,460", strong: true },
        ],
        closingNote: "Thank you for shopping with Saudi Authentic Product.",
        footer: "Saudi Authentic Product",
      });

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [filename, blob] = vi.mocked(downloadBlob).mock.calls[0];
      expect(filename).toBe("Invoice-SAP-20260101-1234-2026-01-01.pdf");
      const header = new Uint8Array(await (blob as Blob).arrayBuffer()).subarray(0, 5);
      expect(String.fromCharCode(...header)).toBe("%PDF-");
    });
  });
});
