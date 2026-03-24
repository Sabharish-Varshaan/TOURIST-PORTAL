"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ScrollReveal, StaggerList } from "@/components/motion";
import { TourismImage } from "@/components/ui/TourismImage";

const EXPLORE_BANNER_IMAGE =
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80";

export default function ExplorePage() {
  const [destination, setDestination] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    itinerary: { day: string; summary: string }[];
    budget: { category: string; amount: number; currency: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) {
      setError("Please select both from and to dates.");
      return;
    }
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (to < from) {
      setError("To date must be after from date.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (destination.trim()) params.set("destination", destination.trim());
      const res = await fetch(`/api/itinerary?${params}`);
      if (!res.ok) throw new Error("Failed to fetch itinerary");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[var(--text)]">
            Tourist Booking Portal
          </Link>
          <span className="text-sm text-[var(--text-muted)]">Explore without login</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1">
        {/* Slim tourism banner */}
        <div className="relative w-full h-40 sm:h-48 rounded-[var(--radius-lg)] overflow-hidden -mx-4 sm:mx-0 mb-8">
          <TourismImage
            src={EXPLORE_BANNER_IMAGE}
            alt="Plan your trip"
            fill
            sizes="(max-width: 768px) 100vw, 896px"
            className="object-cover"
          />
          <div
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: "var(--hero-overlay)" }}
          />
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="text-white font-semibold text-lg sm:text-xl drop-shadow-md px-4 text-center">
              Plan your trip. Get a rough itinerary &amp; budget.
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text)]">
          Get a rough itinerary &amp; budget
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Enter your travel dates. We’ll call external APIs to build a sample plan and budget estimate.
        </p>

        <ScrollReveal>
          <h1 className="text-2xl font-bold text-[var(--text)]">
            Get a rough itinerary &amp; budget
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">
            Enter your travel dates. We'll call external APIs to build a sample plan and budget estimate.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="destination" className="block text-sm font-medium text-[var(--text)] mb-1">
              Destination (city or place)
            </label>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Mumbai, Goa, Paris"
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Optional — add OPENTRIPMAP_API_KEY for real attractions</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="from" className="block text-sm font-medium text-[var(--text)] mb-1">
                From date
              </label>
              <input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-[var(--text)] mb-1">
                To date
              </label>
              <input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className="rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60 transition-colors"
          >
            {loading ? "Loading…" : "Get itinerary & budget"}
          </motion.button>
          </form>
        </ScrollReveal>

        {result && (
          <div className="mt-10 space-y-8">
            <ScrollReveal>
              <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Rough itinerary</h2>
                <StaggerList className="space-y-3" staggerDelay={0.06}>
                  {result.itinerary.map((item, i) => (
                    <li key={i} className="flex gap-3 text-[var(--text)]">
                      <span className="text-[var(--text-muted)] shrink-0">{item.day}</span>
                      <span>{item.summary}</span>
                    </li>
                  ))}
                </StaggerList>
              </section>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Rough budget</h2>
                <p className="text-2xl font-bold text-[var(--primary)]">
                  {result.budget.currency ?? "INR"} {(result.budget.amount ?? 0).toLocaleString()}
                </p>
                <p className="text-sm text-[var(--text-muted)] mt-1">{result.budget.category}</p>
              </section>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <p className="text-sm text-[var(--text-muted)]">
                Like this plan?{" "}
                <Link href="/login" className="text-[var(--primary)] font-medium hover:underline transition-colors">
                  Login
                </Link>{" "}
                to use your full profile, accept the plan, complete e-KYC, and book transport &amp; stays.
              </p>
            </ScrollReveal>
          </div>
        )}
      </main>
    </div>
  );
}
