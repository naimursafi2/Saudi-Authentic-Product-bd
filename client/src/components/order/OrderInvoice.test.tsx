import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrintInvoiceButton } from "./OrderInvoice";
import { downloadInvoicePdf } from "@/lib/pdfExport";
import type { ApiOrder, ApiPayment, ApiSiteSettings } from "@/types/api";

vi.mock("@/lib/pdfExport", () => ({ downloadInvoicePdf: vi.fn() }));

vi.mock("@/lib/api/siteSettings", () => ({
  getSiteSettings: () =>
    Promise.resolve({
      data: { settings: { siteName: "Saudi Authentic Product", contactPhone: "01700000000" } as ApiSiteSettings },
    }),
}));

const getPaymentForOrder = vi.fn();
vi.mock("@/lib/api/payments", () => ({
  getPaymentForOrder: (...args: unknown[]) => getPaymentForOrder(...args),
}));

const order: ApiOrder = {
  _id: "order1",
  orderNumber: "SAP-20260101-1234",
  customer: { _id: "cust1", name: "Jane Doe", email: "jane@example.com" },
  items: [
    {
      product: "prod1",
      productName: "Ajwa Dates",
      variantId: "v1",
      variantLabel: "500g",
      unitPriceBDT: 1200,
      quantity: 2,
      lineTotalBDT: 2400,
    },
  ],
  shippingAddress: {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "01812345678",
    fullAddress: "House 1, Road 2",
    district: "Dhaka",
    cityArea: "Gulshan",
  },
  deliveryMethod: "standard",
  shippingFeeBDT: 60,
  paymentMethod: "cod",
  isPaid: false,
  subtotalBDT: 2400,
  discountBDT: 0,
  totalBDT: 2460,
  status: "pending",
  statusHistory: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PrintInvoiceButton", () => {
  // This project's vitest setup has no global auto-cleanup, so a second test
  // in the same file would otherwise render into the first one's leftover DOM.
  afterEach(cleanup);

  it("opens an invoice showing the order's items, address and totals", async () => {
    getPaymentForOrder.mockResolvedValue({ data: { payment: null } });
    const user = userEvent.setup();
    render(<PrintInvoiceButton order={order} />);

    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(screen.getByText(/Order #SAP-20260101-1234/)).toBeInTheDocument();
    expect(screen.getByText("Ajwa Dates")).toBeInTheDocument();
    expect(screen.getByText("500g")).toBeInTheDocument();
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
    expect(screen.getByText("Cash on Delivery")).toBeInTheDocument();
    expect(screen.getByText("Unpaid")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Saudi Authentic Product/).length).toBeGreaterThan(0);
    });
  });

  it("shows the bKash transaction reference on a paid gateway order", async () => {
    getPaymentForOrder.mockResolvedValue({
      data: {
        payment: {
          _id: "pay1",
          transactionId: "BKH7X2QK91",
          paidAt: "2026-01-02T10:00:00.000Z",
          status: "paid",
        } as ApiPayment,
      },
    });
    const user = userEvent.setup();
    render(<PrintInvoiceButton order={{ ...order, paymentMethod: "bkash", isPaid: true }} />);

    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(screen.getByText("bKash")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("BKH7X2QK91")).toBeInTheDocument();
    });
  });

  it("itemises subtotal, shipping and total, and shows a discount line only when one applies", async () => {
    getPaymentForOrder.mockResolvedValue({ data: { payment: null } });
    const user = userEvent.setup();
    render(<PrintInvoiceButton order={order} />);
    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Shipping")).toBeInTheDocument();
    // "Total" is also a line-items column header, so scope to the totals block.
    expect(screen.getByText("Total", { selector: "span" })).toBeInTheDocument();
    // This order carries no coupon, so no discount row is rendered at all.
    expect(screen.queryByText(/^Discount/)).not.toBeInTheDocument();
  });

  it("names the coupon on the discount line when the order was discounted", async () => {
    getPaymentForOrder.mockResolvedValue({ data: { payment: null } });
    const user = userEvent.setup();
    render(
      <PrintInvoiceButton
        order={{ ...order, discountBDT: 200, couponCode: "EID200", totalBDT: 2260 }}
      />
    );
    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(screen.getByText("Discount (EID200)")).toBeInTheDocument();
  });

  it("downloads a PDF built from the order, naming the file after it", async () => {
    getPaymentForOrder.mockResolvedValue({ data: { payment: null } });
    const user = userEvent.setup();
    render(<PrintInvoiceButton order={order} />);

    await user.click(screen.getByRole("button", { name: /print invoice/i }));
    await user.click(screen.getByRole("button", { name: /^print$/i }));

    // Print downloads a generated PDF directly — never window.print(), which
    // would put two dialogs between the click and the file. The order's own
    // date is passed, so re-downloading months later yields the same filename.
    expect(downloadInvoicePdf).toHaveBeenCalledTimes(1);
    const options = vi.mocked(downloadInvoicePdf).mock.calls[0][0];
    expect(options.filenamePrefix).toBe("Invoice-SAP-20260101-1234");
    expect(options.dateContext).toBe("2026-01-01T00:00:00.000Z");
    // The PDF is built from the same order the preview renders, so the two can
    // never disagree about what was actually billed.
    expect(options.rows).toEqual([["Ajwa Dates (500g)", "৳ 1,200", 2, "৳ 2,400"]]);
    expect(options.totals.at(-1)).toEqual({ label: "Total", value: "৳ 2,460", strong: true });
  });

  it("still renders a complete invoice when the payment lookup is unavailable", async () => {
    // A viewer without payments.view (or an order with no gateway record)
    // must not lose the invoice — the reference row is simply omitted.
    getPaymentForOrder.mockRejectedValue(new Error("forbidden"));
    const user = userEvent.setup();
    render(<PrintInvoiceButton order={order} />);

    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(screen.getByText(/Order #SAP-20260101-1234/)).toBeInTheDocument();
    expect(screen.getByText("Ajwa Dates")).toBeInTheDocument();
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });
});
