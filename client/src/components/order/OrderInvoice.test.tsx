import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrintInvoiceButton } from "./OrderInvoice";
import type { ApiOrder, ApiSiteSettings } from "@/types/api";

vi.mock("@/lib/api/siteSettings", () => ({
  getSiteSettings: () =>
    Promise.resolve({
      data: { settings: { siteName: "Saudi Authentic Product", contactPhone: "01700000000" } as ApiSiteSettings },
    }),
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
  it("opens an invoice showing the order's items, address and totals", async () => {
    const user = userEvent.setup();
    render(<PrintInvoiceButton order={order} />);

    await user.click(screen.getByRole("button", { name: /print invoice/i }));

    expect(screen.getByText(/Order #SAP-20260101-1234/)).toBeInTheDocument();
    expect(screen.getByText("Ajwa Dates")).toBeInTheDocument();
    expect(screen.getByText("500g")).toBeInTheDocument();
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
    expect(screen.getByText("Unpaid")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Saudi Authentic Product/).length).toBeGreaterThan(0);
    });
  });
});
