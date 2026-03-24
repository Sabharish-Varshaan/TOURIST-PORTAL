"use client";

import Link from "next/link";
import { ScrollReveal } from "@/components/motion";

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[var(--text)]">
            Tourist Booking Portal
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/explore" className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
              Explore
            </Link>
            <Link href="/login" className="text-[var(--primary)] font-medium transition-colors hover:text-[var(--primary-hover)]">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 flex-1">
        <ScrollReveal>
          <h1 className="text-2xl font-bold text-[var(--text)]">Pricing</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Explore without login is free. Sign in to use your travel profile, e-KYC, and book transport, hotels & restaurants — linked to our tourist app.
        </p>
        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
          <h2 className="font-semibold text-[var(--text)]">Free to explore</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Enter dates, get a rough itinerary and budget. No account needed. When you’re ready, login to book and link everything to our tourist safety app.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)]"
          >
            Back to home
          </Link>
        </div>
        </ScrollReveal>
      </main>
    </div>
  );
}
