"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useProductsByIds } from "@/lib/hooks/useProductsByIds";
import type { CartLine, Product, ProductVariant } from "@/types/product";

const STORAGE_KEY = "sap:cart";

export interface CartItemView {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  lineTotal: number;
}

interface CartContextValue {
  lines: CartLine[];
  items: CartItemView[];
  subtotal: number;
  totalQuantity: number;
  isDrawerOpen: boolean;
  isLoading: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (productId: string, variantId: string, quantity?: number) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // One-time hydration from localStorage after mount — localStorage isn't
  // available during SSR, so this can't be computed during render.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const addItem = useCallback(
    (productId: string, variantId: string, quantity = 1) => {
      setLines((prev) => {
        const existing = prev.find(
          (l) => l.productId === productId && l.variantId === variantId
        );
        if (existing) {
          return prev.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + quantity } : l
          );
        }
        return [...prev, { productId, variantId, quantity }];
      });
      setIsDrawerOpen(true);
    },
    []
  );

  const removeItem = useCallback((productId: string, variantId: string) => {
    setLines((prev) =>
      prev.filter((l) => !(l.productId === productId && l.variantId === variantId))
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, variantId: string, quantity: number) => {
      setLines((prev) => {
        if (quantity <= 0) {
          return prev.filter(
            (l) => !(l.productId === productId && l.variantId === variantId)
          );
        }
        return prev.map((l) =>
          l.productId === productId && l.variantId === variantId
            ? { ...l, quantity }
            : l
        );
      });
    },
    []
  );

  const clearCart = useCallback(() => setLines([]), []);

  const productIds = useMemo(() => lines.map((l) => l.productId), [lines]);
  const { productsById, isLoading } = useProductsByIds(productIds);

  const items = useMemo<CartItemView[]>(() => {
    return lines
      .map((line) => {
        const product = productsById[line.productId];
        const variant = product?.variants.find((v) => v.id === line.variantId);
        if (!product || !variant) return null;
        return {
          product,
          variant,
          quantity: line.quantity,
          lineTotal: variant.priceBDT * line.quantity,
        };
      })
      .filter((x): x is CartItemView => x !== null);
  }, [lines, productsById]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.lineTotal, 0),
    [items]
  );

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const value: CartContextValue = {
    lines,
    items,
    subtotal,
    totalQuantity,
    isDrawerOpen,
    isLoading,
    openDrawer: () => setIsDrawerOpen(true),
    closeDrawer: () => setIsDrawerOpen(false),
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
