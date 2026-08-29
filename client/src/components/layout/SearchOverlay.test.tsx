import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SearchOverlay, rankProductMatches } from "./SearchOverlay";
import type { Product } from "@/types/product";
import * as productsApi from "@/lib/api/products";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api/products", () => ({
  listProducts: vi.fn(),
}));

describe("SearchOverlay", () => {
  const mockedListProducts = vi.mocked(productsApi.listProducts);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("matches relevant single-letter and partial product searches case-insensitively", () => {
    const products: Product[] = [
      {
        id: "1",
        slug: "premium-dates",
        name: "Premium Dates",
        tagline: "Sweet and fresh",
        description: "Best dates for gifting",
        origin: "Madinah, Saudi Arabia",
        categories: [{ id: "c1", name: "Dates", slug: "dates" }],
        images: [],
        visual: { tone: "green", icon: "Package" },
        badge: "Authentic",
        ratingAverage: 5,
        ratingCount: 10,
        variants: [{ id: "v1", label: "1kg", priceBDT: 1200, stock: 10 }],
        highlights: ["Sweet", "Premium"],
        storageInstructions: "Store in a cool place",
      },
      {
        id: "2",
        slug: "royal-watch",
        name: "Royal Watch",
        tagline: "Classic timepiece",
        description: "Elegant watch for daily wear",
        origin: "Dubai",
        categories: [{ id: "c2", name: "Watches", slug: "watches" }],
        images: [],
        visual: { tone: "gold", icon: "Watch" },
        ratingAverage: 4.8,
        ratingCount: 8,
        variants: [{ id: "v2", label: "Classic", priceBDT: 2200, stock: 7 }],
        highlights: ["Luxury", "Classic"],
      },
      {
        id: "3",
        slug: "wild-honey",
        name: "Wild Honey",
        tagline: "Raw and natural",
        description: "Pure honey from nature",
        origin: "Qassim",
        categories: [{ id: "c3", name: "Honey", slug: "honey" }],
        images: [],
        visual: { tone: "brown", icon: "Droplet" },
        ratingAverage: 4.9,
        ratingCount: 12,
        variants: [{ id: "v3", label: "500g", priceBDT: 900, stock: 20 }],
        highlights: ["Raw", "Pure"],
      },
      {
        id: "4",
        slug: "olive-oil",
        name: "Olive Oil",
        tagline: "Cold pressed",
        description: "Premium olive oil",
        origin: "Saudi Arabia",
        categories: [{ id: "c4", name: "Oil", slug: "oil" }],
        images: [],
        visual: { tone: "cream", icon: "Droplet" },
        ratingAverage: 4.7,
        ratingCount: 9,
        variants: [{ id: "v4", label: "1L", priceBDT: 850, stock: 15 }],
        highlights: ["Cold pressed"],
      },
    ];

    expect(
      rankProductMatches(products, "d").some((product) =>
        product.name.toLowerCase().includes("date"),
      ),
    ).toBe(true);
    expect(
      rankProductMatches(products, "W").some((product) =>
        product.name.toLowerCase().includes("watch"),
      ),
    ).toBe(true);
    expect(
      rankProductMatches(products, "h").some((product) =>
        product.name.toLowerCase().includes("honey"),
      ),
    ).toBe(true);
    expect(
      rankProductMatches(products, "o").some((product) =>
        product.name.toLowerCase().includes("oil"),
      ),
    ).toBe(true);
    expect(rankProductMatches(products, "da")[0].name.toLowerCase()).toContain(
      "date",
    );
    expect(rankProductMatches(products, "wat")[0].name.toLowerCase()).toContain(
      "watch",
    );
  });

  it("clears stale loading state when the search term is emptied", async () => {
    mockedListProducts.mockImplementation(() => new Promise(() => undefined));

    render(<SearchOverlay open={true} onClose={vi.fn()} />);

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "dates" } });

    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(mockedListProducts).toHaveBeenCalledWith({ q: "dates", limit: 100 });
    expect(screen.getByText(/Searching/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Searching/i)).not.toBeInTheDocument();
  });
});
