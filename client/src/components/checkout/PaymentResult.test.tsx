import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentResult } from "./PaymentResult";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => search,
}));

const getPaymentForOrder = vi.fn();
const initSslcommerzPayment = vi.fn();
vi.mock("@/lib/api/payments", () => ({
  getPaymentForOrder: (...args: unknown[]) => getPaymentForOrder(...args),
  initSslcommerzPayment: (...args: unknown[]) => initSslcommerzPayment(...args),
}));

describe("PaymentResult", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getPaymentForOrder.mockResolvedValue({
      data: { payment: { amountBDT: 1500, transactionId: "BANK123", merchantInvoiceNumber: "SAP-1" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function advance(seconds: number) {
    for (let i = 0; i < seconds; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
  }

  it("shows the success page for 4 seconds, then redirects to the customer's orders", async () => {
    search = new URLSearchParams({ orderId: "o1", order: "SAP-1" });
    render(<PaymentResult kind="success" />);

    expect(screen.getByText("Payment Successful")).toBeInTheDocument();
    expect(screen.getByText("SAP-1")).toBeInTheDocument();

    await advance(3);
    expect(replace).not.toHaveBeenCalled();

    await advance(1);
    expect(replace).toHaveBeenCalledWith("/account");
  });

  it("shows the cancelled page with a retry option, then redirects after 4 seconds", async () => {
    search = new URLSearchParams({ orderId: "o1", order: "SAP-1" });
    render(<PaymentResult kind="cancelled" />);

    expect(screen.getByText("Payment Cancelled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

    await advance(4);
    expect(replace).toHaveBeenCalledWith("/account");
  });

  it("does not auto-redirect while a payment is still being verified", async () => {
    search = new URLSearchParams({ orderId: "o1", reason: "verification_pending" });
    render(<PaymentResult kind="failed" />);

    expect(screen.getByText("Payment Failed")).toBeInTheDocument();
    expect(screen.getByText(/still confirming this payment/i)).toBeInTheDocument();

    await advance(6);
    expect(replace).not.toHaveBeenCalled();
  });
});
