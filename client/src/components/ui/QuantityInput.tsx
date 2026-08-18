"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 99,
  className,
}: QuantityInputProps) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center border border-green-900/20 rounded",
        className
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-full w-10 items-center justify-center text-green-950 transition-colors hover:bg-green-950/5 disabled:opacity-30"
      >
        <Minus size={14} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value.replace(/\D/g, ""));
          if (!Number.isNaN(parsed)) {
            onChange(Math.min(max, Math.max(min, parsed || min)));
          }
        }}
        className="h-full w-10 border-x border-green-900/20 bg-transparent text-center text-sm font-semibold text-green-950 focus:outline-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-full w-10 items-center justify-center text-green-950 transition-colors hover:bg-green-950/5 disabled:opacity-30"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
