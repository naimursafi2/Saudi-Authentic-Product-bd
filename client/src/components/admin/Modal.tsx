"use client";

import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 cursor-pointer bg-green-950/40" onClick={onClose} />
      <div
        className={`relative max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-lg bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-brown-600/10 px-6 py-4">
          <h2 className="font-serif text-lg text-green-950">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="cursor-pointer text-brown-500 hover:text-green-950">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
