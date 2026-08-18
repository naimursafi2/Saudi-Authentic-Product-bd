import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ApiProduct } from "@/types/api";
import { CartProvider, useCart } from "./CartContext";

const listProducts = vi.fn();
vi.mock("@/lib/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}));

function makeApiProduct(id: string, variantId: string, priceBDT: number, stock = 10): ApiProduct {
  return {
    _id: id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    tagline: "Tagline",
    description: "Description",
    origin: "Madinah",
    categories: [],
    images: [],
    variants: [{ _id: variantId, label: "500g", priceBDT, stock, lowStockThreshold: 5 }],
    highlights: [],
    ratingAverage: 0,
    ratingCount: 0,
    isBestSeller: false,
    isFeatured: false,
    isActive: true,
    minPriceBDT: priceBDT,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("CartContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    listProducts.mockReset();
    listProducts.mockResolvedValue({ data: { products: [] }, message: "ok" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <CartProvider>{children}</CartProvider>;
  }

  it("adds an item, resolves it against the API, and computes the subtotal", async () => {
    listProducts.mockResolvedValue({
      data: { products: [makeApiProduct("p1", "v1", 1200)] },
      message: "ok",
    });

    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem("p1", "v1", 2);
    });

    expect(result.current.lines).toEqual([{ productId: "p1", variantId: "v1", quantity: 2 }]);
    expect(result.current.isDrawerOpen).toBe(true);

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.subtotal).toBe(2400);
    expect(result.current.totalQuantity).toBe(2);
  });

  it("increments quantity when the same product/variant is added twice", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem("p1", "v1", 1);
      result.current.addItem("p1", "v1", 1);
    });

    expect(result.current.lines).toEqual([{ productId: "p1", variantId: "v1", quantity: 2 }]);
  });

  it("removes a line item", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem("p1", "v1", 1);
    });
    act(() => {
      result.current.removeItem("p1", "v1");
    });

    expect(result.current.lines).toEqual([]);
  });

  it("updateQuantity removes the line when quantity drops to 0", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem("p1", "v1", 3);
    });
    act(() => {
      result.current.updateQuantity("p1", "v1", 0);
    });

    expect(result.current.lines).toEqual([]);
  });

  it("clearCart empties the cart", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem("p1", "v1", 1);
      result.current.addItem("p2", "v2", 1);
    });
    act(() => {
      result.current.clearCart();
    });

    expect(result.current.lines).toEqual([]);
  });

  it("persists lines to localStorage and hydrates a new provider instance from it", async () => {
    const { result, unmount } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem("p1", "v1", 1);
    });

    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem("sap:cart") ?? "[]")).toEqual([
        { productId: "p1", variantId: "v1", quantity: 1 },
      ])
    );
    unmount();

    const { result: result2 } = renderHook(() => useCart(), { wrapper });
    await waitFor(() =>
      expect(result2.current.lines).toEqual([{ productId: "p1", variantId: "v1", quantity: 1 }])
    );
  });
});
