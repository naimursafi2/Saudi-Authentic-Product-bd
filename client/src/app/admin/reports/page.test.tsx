import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminReportsPage from "./page";
import { downloadReportPdf } from "@/lib/pdfExport";
import type { SalesSummary, SalesTimeSeriesPoint } from "@/types/hr";
import type { ApiSiteSettings } from "@/types/api";

/**
 * The Sales Report's Print action. What matters is that clicking Print
 * downloads a PDF built from THIS page's own live report data — the rows, the
 * total and the active filters it is currently showing — rather than from a
 * shared print container or any other page's leftover content. The report's
 * total is included deliberately: the period rows alone list every bucket but
 * never their sum, which is the one number the reader most needs.
 */

const summary: SalesSummary = {
  totalRevenueBDT: 19270,
  totalOrders: 4,
  averageOrderValueBDT: 4818,
  ordersByStatus: { pending: 3, delivered: 1 },
  topProducts: [],
};

const timeSeries: SalesTimeSeriesPoint[] = [
  { period: "2026-08-14", revenueBDT: 1260, orders: 1 },
  { period: "2026-08-16", revenueBDT: 10350, orders: 1 },
  { period: "2026-08-18", revenueBDT: 1360, orders: 1 },
  { period: "2026-08-28", revenueBDT: 6300, orders: 1 },
];

vi.mock("@/lib/pdfExport", () => ({ downloadReportPdf: vi.fn() }));

vi.mock("@/lib/api/reports", () => ({
  getSalesSummary: () => Promise.resolve({ data: { sales: summary } }),
  getSalesTimeSeries: () => Promise.resolve({ data: { timeSeries } }),
  getDeliveryAgentPerformance: () => Promise.resolve({ data: { agents: [] } }),
}));

vi.mock("@/lib/api/siteSettings", () => ({
  getSiteSettings: () =>
    Promise.resolve({ data: { settings: { siteName: "Saudi Authentic Product" } as ApiSiteSettings } }),
}));

async function renderReport() {
  render(<AdminReportsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^print$/i })).toBeEnabled());
}

describe("Sales Report print", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(downloadReportPdf).mockClear();
  });

  it("downloads a PDF built from this page's own report rows", async () => {
    const user = userEvent.setup();
    await renderReport();

    await user.click(screen.getByRole("button", { name: /^print$/i }));

    // Passed as data, not scraped from the DOM — so no other page's content
    // can reach this file. The grouping is part of the filename so a Daily and
    // a Monthly report downloaded the same day cannot land as the same name
    // plus a "(1)" suffix, which is how an older file gets opened by mistake.
    const options = vi.mocked(downloadReportPdf).mock.calls[0][0];
    expect(options.filenamePrefix).toBe("Sales-Report-Daily");
    expect(options.rows).toEqual([
      ["2026-08-14", "৳ 1,260", 1],
      ["2026-08-16", "৳ 10,350", 1],
      ["2026-08-18", "৳ 1,360", 1],
      ["2026-08-28", "৳ 6,300", 1],
    ]);
  });

  it("carries the total, and the same figure the on-screen tile shows", async () => {
    const user = userEvent.setup();
    await renderReport();

    await user.click(screen.getByRole("button", { name: /^print$/i }));

    const options = vi.mocked(downloadReportPdf).mock.calls[0][0];
    expect(options.total).toEqual({
      label: "Total Revenue",
      value: "৳ 19,270",
      note: "4 orders in this period",
    });
    // Both the on-screen tile and the report block read
    // `summary.totalRevenueBDT`, the same field the PDF is given, so the
    // screen and the downloaded file cannot drift apart.
    const onScreen = screen.getAllByText("Total Revenue").map((el) => el.closest("div")?.textContent ?? "");
    expect(onScreen.some((text) => text.includes("19,270"))).toBe(true);
  });

  it("records which grouping and date range the figures came from", async () => {
    const user = userEvent.setup();
    await renderReport();

    await user.click(screen.getByRole("button", { name: /^print$/i }));

    const options = vi.mocked(downloadReportPdf).mock.calls[0][0];
    expect(options.title).toBe("Daily Sales Report");
    // Unfiltered here, but the line always states the range the rows cover so
    // a saved file is never ambiguous about which slice of data it holds.
    expect(options.meta).toEqual(["Period: Earliest order – Latest order"]);
  });
});
