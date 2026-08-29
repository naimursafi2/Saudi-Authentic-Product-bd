import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printWithFilename } from "./print";

/**
 * The single print mechanism used by every "Print" action project-wide
 * (invoices, the Sales Report, the Expenses monthly report). The behaviours
 * pinned here are the ones that are easy to break and silently wrong in
 * production: Chrome takes its suggested "Save as PDF" filename from
 * `document.title`, and reads it one macrotask *after* the click — so the
 * title has to be stamped, the print deferred, and the original title put
 * back afterwards.
 */
describe("printWithFilename", () => {
  let printSpy: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 9, 14, 30));
    printSpy = vi.fn<() => void>();
    window.print = printSpy;
    document.title = "Admin Portal";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stamps the title with today's date and only then opens the print dialog", () => {
    printWithFilename("Sales-Report");

    // Deferred by design — calling window.print() in the same tick is a known
    // Chrome race where the dialog still reads the previous title.
    expect(printSpy).not.toHaveBeenCalled();
    expect(document.title).toBe("Sales-Report-2026-03-09");

    vi.advanceTimersByTime(100);
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("restores the page's original title once the dialog has opened", () => {
    printWithFilename("Invoice");
    vi.advanceTimersByTime(100);

    expect(document.title).toBe("Admin Portal");
  });

  it("zero-pads single-digit months and days so the filename always sorts correctly", () => {
    vi.setSystemTime(new Date(2026, 0, 5));
    printWithFilename("Expenses");

    expect(document.title).toBe("Expenses-2026-01-05");
  });

  it("generates the date at click time, not at module load", () => {
    printWithFilename("Invoice");
    expect(document.title).toBe("Invoice-2026-03-09");
    vi.advanceTimersByTime(100);

    vi.setSystemTime(new Date(2026, 11, 25));
    printWithFilename("Invoice");
    expect(document.title).toBe("Invoice-2026-12-25");
  });
});
