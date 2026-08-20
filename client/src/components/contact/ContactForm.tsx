"use client";

import { Button } from "@/components/ui/Button";

export function ContactForm() {
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-4 rounded-lg border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
    >
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
          Name
        </label>
        <input
          required
          placeholder="Your Name"
          className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
          Email
        </label>
        <input
          required
          type="email"
          placeholder="you@example.com"
          className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
          Message
        </label>
        <textarea
          required
          rows={4}
          placeholder="How can we help?"
          className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
        />
      </div>
      <Button type="submit" variant="primary" size="lg" className="mt-2 w-full">
        Send Message
      </Button>
    </form>
  );
}
