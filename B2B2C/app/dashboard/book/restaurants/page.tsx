"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function BookRestaurantsPage() {
  const router = useRouter();
  const [touristId, setTouristId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; price: number; cuisine?: string }[]>([]);
  const [booked, setBooked] = useState<string | null>(null);
  const [safetyEnabled, setSafetyEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("tourist_id") : null;
    if (!id) router.replace("/login");
    else setTouristId(id);
  }, [router]);

  const search = async () => {
    if (!location.trim() || !date) {
      setError("Please fill location and date.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/book/restaurants?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.options || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const book = async (optionId: string) => {
    if (!touristId) return;
    setLoading(true);
    setError(null);
    setSafetyEnabled(false);
    const safetyAddOn = typeof window !== "undefined" && localStorage.getItem("safety_add_on") === "true";
    try {
      const res = await fetch("/api/book/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourist_id: touristId,
          option_id: optionId,
          location,
          date,
          safety_add_on: safetyAddOn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      setBooked(optionId);
      if (data.safety_enabled) setSafetyEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  if (!touristId) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-[var(--text)]">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-3">
            {process.env.NEXT_PUBLIC_TOURIST_APP_URL && (
              <a
                href={process.env.NEXT_PUBLIC_TOURIST_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
              >
                Open safety app
              </a>
            )}
            <span className="text-sm text-[var(--text-muted)]">Restaurants</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold text-[var(--text)]">Book restaurants</h1>
        <p className="mt-1 text-[var(--text-muted)] text-sm">
          Book dining — linked to our SOS safety app. Add safety for this trip from the dashboard first.
        </p>

        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or area"
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="mt-4 rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search restaurants"}
        </button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {results.length > 0 && (
          <ul className="mt-8 space-y-3">
            {results.map((opt) => (
              <li
                key={opt.id}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-[var(--text)]">{opt.name}</span>
                  {opt.cuisine && <span className="ml-2 text-sm text-[var(--text-muted)]">{opt.cuisine}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[var(--primary)]">₹{opt.price} for 2</span>
                  {booked === opt.id ? (
                    <span className="text-sm text-[var(--success)] font-medium">Booked</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => book(opt.id)}
                      disabled={loading}
                      className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
                    >
                      Book
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {booked && safetyEnabled && process.env.NEXT_PUBLIC_TOURIST_APP_URL && (
          <section className="mt-8 rounded-[var(--radius-lg)] border-2 border-[var(--primary)] bg-[var(--primary)]/10 p-6">
            <h2 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2">
              <span aria-hidden>🛡️</span> Safety enabled for this trip
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Your booking is linked to our safety app. Open it to use SOS, live location &amp; incident response.
            </p>
            <a
              href={process.env.NEXT_PUBLIC_TOURIST_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-5 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)]"
            >
              Start safety for this trip
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
