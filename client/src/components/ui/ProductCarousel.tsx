"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Product } from "@/types/product";
import { ProductCard } from "./ProductCard";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 3500;
const TRANSITION_MS = 450;
/** Pointer movement (px) beyond which a mouse/touch-down-and-move counts as
 *  a drag rather than a click — below this, releasing still opens the
 *  card's link normally. */
const DRAG_CLICK_THRESHOLD = 6;
/** Fraction of one *card's* width a drag must cover before it commits to
 *  the next/previous card — short of that, it springs back to the card it
 *  started on. A drag is a one-card-at-a-time gesture either way (never
 *  more, regardless of how far past this it's dragged). */
const DRAG_COMMIT_RATIO = 0.15;

/** Same column counts as `PRODUCT_GRID_CLASS` (2/3/4/5 up), expressed as a
 *  per-card flex-basis so the carousel reads as "the same grid, but
 *  sliding" rather than a differently-proportioned component. Kept in one
 *  place alongside `VISIBLE_COUNT_BREAKPOINTS` below so the two can never
 *  drift out of sync with each other. */
const CARD_WIDTH_CLASS =
  "w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.834rem)] lg:w-[calc(25%-0.9375rem)] xl:w-[calc(20%-1rem)]";

/** Mirrors the Tailwind breakpoints baked into `CARD_WIDTH_CLASS` above, so
 *  the carousel knows how many cards are actually on screen at once
 *  (checked widest-first) — purely to know how far the window can slide
 *  (`maxIndex = products.length - visibleCount`); movement itself is always
 *  one card, regardless of how many are visible. */
const VISIBLE_COUNT_BREAKPOINTS: Array<{ minWidth: number; count: number }> = [
  { minWidth: 1280, count: 5 },
  { minWidth: 1024, count: 4 },
  { minWidth: 640, count: 3 },
  { minWidth: 0, count: 2 },
];

function getVisibleCount() {
  if (typeof window === "undefined") return 2;
  const width = window.innerWidth;
  return VISIBLE_COUNT_BREAKPOINTS.find((bp) => width >= bp.minWidth)?.count ?? 2;
}

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** How many cards are visible at once at the current breakpoint, read via
 *  `useSyncExternalStore` (not `useEffect` + `setState`, which this
 *  project's lint config — the React Compiler rules — rejects) so the
 *  server snapshot (2, the base breakpoint) and the first client render
 *  agree, with no hydration mismatch. */
function useVisibleCount() {
  return useSyncExternalStore(subscribeToResize, getVisibleCount, () => 2);
}

/** Reads the track's *actual current* rendered X offset, accounting for a
 *  CSS transition still in flight — used only when a drag starts, so
 *  grabbing the slider mid-animation continues from where it visually is
 *  rather than snapping to whatever the last committed target was. */
function getCurrentTranslateX(el: HTMLElement): number {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return 0;
  return -new DOMMatrixReadOnly(transform).m41;
}

/**
 * Horizontal product slider used by every homepage product rail (Best
 * Sellers, category/on-sale/new-arrival showcases). Moves through the
 * product list **one card at a time** — dragging, autoplay, a dot click,
 * each slide the visible window by exactly one card — while always keeping
 * the same number of cards on screen (`visibleCount`, from
 * `VISIBLE_COUNT_BREAKPOINTS`) and never reordering or skipping products:
 * `[1 2 3 4]` → drag → `[2 3 4 5]` → drag → `[3 4 5 6]`, never `[5 6 7 8]`.
 *
 * This is a **bounded window, not an infinite loop** — an earlier version
 * of this component tripled the product list to loop forever and stepped a
 * full page (`visibleCount` cards) at a time; both of those were
 * deliberately removed here. The visible window's start index
 * (`activeIndex`) is clamped to `[0, products.length - visibleCount]` and
 * simply stops at either end — `[5 6 7 8]` is the last position for 8
 * products at 4-visible, and nothing moves further or leaves an empty gap.
 * Rendering the product list once (not tripled) is what makes that
 * boundary trivial to enforce: there's no second/third copy to wrap into,
 * so "clamp the position" is the entire implementation.
 *
 * Position is driven entirely by JS — a single `positionPxRef` (px) that
 * every input funnels through `applyPosition`, which clamps it into that
 * range, writes the `transform`, and derives `activeIndex` from it. There
 * is deliberately no second code path that independently tracks position,
 * so autoplay, a dot click, and a drag can't drift out of sync with each
 * other or with the dots.
 *
 * This does **not** use native horizontal scrolling (`overflow-x-auto` +
 * `scrollLeft`), which an earlier version of this component was built on.
 * That combination fought itself once a mouse-drag was layered on top: CSS
 * `scroll-snap` resisting a directly-assigned `scrollLeft` on every
 * `pointermove` (felt like the slider sticking), and
 * `element.setPointerCapture()` intermittently retargeting the
 * `pointerup`/`click` pair away from the `<ProductCard>` link underneath the
 * cursor (a plain click stopped opening the product page). Moving the track
 * with `transform` inside a plain `overflow-hidden` viewport sidesteps
 * both — there's no native scroll gesture for anything to fight, and
 * reading the live value is a `getComputedStyle` parse
 * (`getCurrentTranslateX`) instead of a scroll position the browser is also
 * trying to own.
 *
 * The track's className is `w-full`, **not** `w-max`/`w-fit` — each card's
 * width (`CARD_WIDTH_CLASS`) is a *percentage*, which can only resolve
 * against a track with a definite width. With `w-full` the track's own box
 * is exactly one viewport wide; its content still naturally overflows that
 * box whenever there are more than `visibleCount` products (`shrink-0` on
 * every card, so they never compress to fit), which is fine —
 * `overflow-hidden` on the viewport clips it for display.
 *
 * Card width is measured once (on mount and on resize) into `stepWidthRef`
 * rather than re-measured with `getBoundingClientRect` on every drag frame
 * — that forces a synchronous layout, and doing that 60+ times a second
 * during a drag is what made an earlier version of this component feel
 * laggy.
 *
 * Mouse and touch share one code path via Pointer Events, listened on
 * `window` (not captured on the track — see the pointer-capture note
 * above) for the duration of an active drag, torn down together via an
 * `AbortController` created in the `pointerdown` handler. The track carries
 * Tailwind's `touch-pan-y`, so a vertical touch gesture is left entirely to
 * the browser's native page scroll (delivered here as a `pointercancel`,
 * which ends the drag cleanly) while a horizontal one is this component's
 * to animate.
 *
 * A drag always resolves to exactly the next/previous card, never more,
 * never a partial one: while the pointer is down the track follows it 1:1
 * (live, no easing); on release, `endDrag` compares the net displacement
 * against `DRAG_COMMIT_RATIO` of one card's width — short of that it
 * springs back (animated) to the card it started on, past it, it commits
 * to exactly one card forward or back in the drag's direction. A
 * capture-phase `click` handler swallows exactly the one click that
 * follows a real drag (tracked via a ref that flips once pointer movement
 * exceeds `DRAG_CLICK_THRESHOLD`), so a drag never accidentally opens the
 * product page, while an ordinary click still does.
 *
 * The dots represent every single-card position the window can stop at
 * (`products.length - visibleCount + 1` of them — 5 dots for 8 products at
 * 4-visible), not pages/groups — clicking one jumps straight to that
 * window position.
 */
export function ProductCarousel({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stepWidthRef = useRef(0);
  const positionPxRef = useRef(0);
  const isDraggingRef = useRef(false);
  const draggedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPositionRef = useRef(0);
  const dragAbortRef = useRef<AbortController | null>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleCount = useVisibleCount();
  /** Bumped by every manual dot click, purely to restart the autoplay
   *  interval — otherwise a click landing late in the cycle is followed
   *  almost immediately by an automatic advance, which reads as the
   *  carousel jumping away from the slide just chosen (same reasoning as
   *  `HeroCarousel`'s `restartKey`). */
  const [restartKey, setRestartKey] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const maxIndex = Math.max(0, products.length - visibleCount);
  const canSlide = maxIndex > 0;
  const dotCount = maxIndex + 1;

  const measureTrack = useCallback(() => {
    const track = trackRef.current;
    const firstCard = track?.firstElementChild as HTMLElement | null;
    if (!track || !firstCard) return;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0");
    stepWidthRef.current = firstCard.getBoundingClientRect().width + gap;
  }, []);

  /** The one function that ever writes `transform`. Clamps the position to
   *  `[0, maxIndex]` cards and derives `activeIndex` from it — see the
   *  component doc comment above for why this consolidation matters. */
  const applyPosition = useCallback(
    (rawPx: number, { animate }: { animate: boolean }) => {
      const track = trackRef.current;
      if (!track) return;
      const step = stepWidthRef.current;
      const maxPx = maxIndex * step;
      const px = Math.max(0, Math.min(maxPx, rawPx));
      track.style.transition =
        animate && !prefersReducedMotion ? `transform ${TRANSITION_MS}ms cubic-bezier(0.22,1,0.36,1)` : "none";
      track.style.transform = `translate3d(${-px}px,0,0)`;
      positionPxRef.current = px;
      if (step) setActiveIndex(Math.round(px / step));
    },
    [maxIndex, prefersReducedMotion]
  );

  useEffect(() => {
    measureTrack();
    applyPosition(0, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per product-list identity, not on every applyPosition identity change
  }, [products]);

  useEffect(() => {
    function onResize() {
      measureTrack();
      applyPosition(Math.min(activeIndex, maxIndex) * stepWidthRef.current, { animate: false });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeIndex, maxIndex, measureTrack, applyPosition]);

  const stepForward = useCallback(() => {
    const step = stepWidthRef.current;
    if (!step) return;
    const currentIndex = Math.round(positionPxRef.current / step);
    // Loops back to the start once it's shown the last position, rather
    // than stopping dead — same "keep it moving" spirit as before, just
    // never skipping or overshooting the bounded window to get there.
    const nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    applyPosition(nextIndex * step, { animate: true });
  }, [applyPosition, maxIndex]);

  useEffect(() => {
    if (!canSlide || isPaused || prefersReducedMotion) return;
    const timer = setInterval(stepForward, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [canSlide, isPaused, prefersReducedMotion, stepForward, restartKey]);

  const goToIndex = useCallback(
    (index: number) => {
      applyPosition(index * stepWidthRef.current, { animate: true });
      setRestartKey((n) => n + 1);
    },
    [applyPosition]
  );

  function handleWindowPointerMove(e: PointerEvent) {
    if (!isDraggingRef.current) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > DRAG_CLICK_THRESHOLD) draggedRef.current = true;
    applyPosition(dragStartPositionRef.current - delta, { animate: false });
  }

  function endDrag() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPaused(false);
    dragAbortRef.current?.abort();
    dragAbortRef.current = null;
    const step = stepWidthRef.current;
    if (!step) return;
    const startIndex = Math.round(dragStartPositionRef.current / step);
    const netDelta = positionPxRef.current - dragStartPositionRef.current;
    const targetIndex =
      Math.abs(netDelta) > step * DRAG_COMMIT_RATIO ? startIndex + (netDelta > 0 ? 1 : -1) : startIndex;
    applyPosition(targetIndex * step, { animate: true });
  }

  useEffect(() => {
    return () => dragAbortRef.current?.abort();
  }, []);

  // Mouse and touch share this one path via Pointer Events, tracked on
  // `window` (not captured — see the doc comment above) for the life of a
  // drag and torn down together via `AbortController`.
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    isDraggingRef.current = true;
    draggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartPositionRef.current = getCurrentTranslateX(track);
    setIsPaused(true);
    const controller = new AbortController();
    dragAbortRef.current = controller;
    window.addEventListener("pointermove", handleWindowPointerMove, { signal: controller.signal });
    window.addEventListener("pointerup", endDrag, { signal: controller.signal });
    window.addEventListener("pointercancel", endDrag, { signal: controller.signal });
  }

  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (!draggedRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    draggedRef.current = false;
  }

  if (products.length === 0) return null;

  return (
    <div>
      <div
        aria-roledescription={canSlide ? "carousel" : undefined}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={() => setIsPaused(false)}
        className="overflow-hidden"
      >
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
          onDragStart={(e) => e.preventDefault()}
          className="flex w-full items-stretch gap-3 select-none touch-pan-y active:cursor-grabbing sm:cursor-grab sm:gap-5"
        >
          {products.map((product) => (
            <div key={product.id} className={`shrink-0 ${CARD_WIDTH_CLASS}`}>
              <ProductCard product={product} className="h-full" />
            </div>
          ))}
        </div>
      </div>

      {canSlide && (
        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: dotCount }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to position ${index + 1}`}
              aria-current={index === activeIndex}
              onClick={() => goToIndex(index)}
              className={cn(
                "h-1.5 cursor-pointer rounded-full transition-all",
                index === activeIndex ? "w-7 bg-gold-500" : "w-1.5 bg-green-900/20 hover:bg-green-900/35"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
