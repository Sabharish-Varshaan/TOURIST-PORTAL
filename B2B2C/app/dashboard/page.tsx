"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ScrollReveal, StaggerList } from "@/components/motion";

type PlanState = "dates" | "plan" | "accepted" | "ekyc" | "booking";
type Profile = { id: string; name?: string; phone?: string; email?: string } | null;

export default function DashboardPage() {
  const router = useRouter();
  const [touristId, setTouristId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [destination, setDestination] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [plan, setPlan] = useState<{ itinerary: { day: string; summary: string }[]; budget: { amount: number; currency: string } } | null>(null);
  const [step, setStep] = useState<PlanState>("dates");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyAddOn, setSafetyAddOn] = useState(false);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("tourist_id") : null;
    if (!id) {
      router.replace("/login");
      return;
    }
    setTouristId(id);
    const stored = typeof window !== "undefined" ? localStorage.getItem("safety_add_on") : null;
    setSafetyAddOn(stored === "true");
    fetch(`/api/tourist/profile/${id}`)
      .then((r) => r.json())
      .then((d) => (d.error ? null : setProfile(d)))
      .catch(() => setProfile(null));
  }, [router]);

  const toggleSafetyAddOn = (value: boolean) => {
    setSafetyAddOn(value);
    if (typeof window !== "undefined") localStorage.setItem("safety_add_on", String(value));
  };

  const handleLogout = () => {
    localStorage.removeItem("tourist_id");
    localStorage.removeItem("qr_png");
    localStorage.removeItem("tourist_name");
    localStorage.removeItem("safety_add_on");
    router.replace("/");
  };

  const safetyAppUrl = process.env.NEXT_PUBLIC_TOURIST_APP_URL || "";
  const [ekycLink, setEkycLink] = useState(safetyAppUrl ? `${safetyAppUrl}/tourist/entry` : "#");
  useEffect(() => {
    if (!safetyAppUrl || !touristId || typeof window === "undefined") return;
    const returnUrl = encodeURIComponent(`${window.location.origin}/dashboard`);
    setEkycLink(`${safetyAppUrl}/tourist/entry?tourist_id=${encodeURIComponent(touristId)}&return_url=${returnUrl}`);
  }, [safetyAppUrl, touristId]);

  const loadPlan = async () => {
    if (!fromDate || !toDate) {
      setError("Select from and to dates.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (destination.trim()) params.set("destination", destination.trim());
      const res = await fetch(`/api/itinerary?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlan(data);
      setStep("plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan.");
    } finally {
      setLoading(false);
    }
  };

  if (!touristId) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-[var(--text)]">
            Tourist Booking Portal
          </Link>
          <div className="flex items-center gap-3">
            {safetyAppUrl && (
              <a
                href={safetyAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
              >
                Open safety app
              </a>
            )}
            <span className="text-sm text-[var(--text-muted)] truncate max-w-[160px]">
              {profile?.name ?? "Tourist"}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1">
        <ScrollReveal>
          <h1 className="text-2xl font-bold text-[var(--text)]">Dashboard</h1>
          <p className="mt-1 text-[var(--text-muted)]">
            Full travel profile, plan, e-KYC, and bookings — linked to our tourist app.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
        <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Travel profile</h2>
          <ul className="space-y-2 text-sm text-[var(--text)]">
            <li><span className="text-[var(--text-muted)]">Name:</span> {profile?.name ?? "—"}</li>
            <li><span className="text-[var(--text-muted)]">Contact:</span> {profile?.phone ?? "—"}</li>
            <li><span className="text-[var(--text-muted)]">Email:</span> {profile?.email ?? "—"}</li>
            <li><span className="text-[var(--text-muted)]">ID:</span> …{touristId.slice(-8)}</li>
          </ul>
        </section>
        </ScrollReveal>

        {step === "dates" && (
          <ScrollReveal>
          <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Travel dates (same as without login)</h2>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Destination (optional)</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Mumbai, Goa"
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <motion.button
              type="button"
              onClick={loadPlan}
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="mt-4 rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60"
            >
              {loading ? "Loading…" : "Get plan"}
            </motion.button>
          </section>
          </ScrollReveal>
        )}

        {step === "plan" && plan && (
          <ScrollReveal>
          <section className="mt-8 space-y-6">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Your plan</h2>
              <p className="text-[var(--primary)] font-semibold">
                {plan.budget.currency ?? "INR"} {(plan.budget.amount ?? 0).toLocaleString()}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[var(--text)]">
                {plan.itinerary.slice(0, 5).map((item, i) => (
                  <li key={i}>{item.day}: {item.summary}</li>
                ))}
              </ul>
              <motion.button
                type="button"
                onClick={() => setStep("accepted")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-6 rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)]"
              >
                Accept plan
              </motion.button>
            </div>
          </section>
          </ScrollReveal>
        )}

        {(step === "accepted" || step === "ekyc" || step === "booking") && (
          <>
            {step === "accepted" && (
              <ScrollReveal>
              <section className="mt-8 space-y-6">
                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
                  <h2 className="text-lg font-semibold text-[var(--text)] mb-2">Plan accepted</h2>
                  <p className="text-[var(--text-muted)] text-sm mb-4">
                    Next: add safety for your trip (optional), complete e-KYC, then book transport, hotels &amp; restaurants — linked to our SOS safety app.
                  </p>
                  <div className="rounded-[var(--radius)] border-2 border-[var(--primary)]/30 bg-[var(--primary)]/5 p-4 flex items-start gap-4">
                    <span className="text-2xl shrink-0" aria-hidden>🛡️</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--text)]">Add GuardianID safety for this trip</h3>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        SOS, live location, incident response &amp; authority chat — stay safe on your trip.
                      </p>
                      <label className="mt-3 flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={safetyAddOn}
                          onChange={(e) => toggleSafetyAddOn(e.target.checked)}
                          className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <span className="text-sm font-medium text-[var(--text)]">Include safety — ₹199</span>
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("ekyc")}
                    className="mt-6 rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)]"
                  >
                    Continue to e-KYC
                  </button>
                </div>
              </section>
              </ScrollReveal>
            )}
            {step === "ekyc" && (
              <ScrollReveal>
              <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-2">Digital ID / e-KYC</h2>
                <p className="text-[var(--text-muted)] text-sm mb-4">
                  e-KYC is done in the safety app. Complete it there; you’ll return here to book.
                </p>
                <a
                  href={ekycLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)]"
                >
                  Open safety app (e-KYC)
                </a>
                <button
                  type="button"
                  onClick={() => setStep("booking")}
                  className="ml-3 rounded-[var(--radius)] border border-[var(--border)] px-6 py-2.5 font-medium text-[var(--text)] hover:bg-[var(--border)]"
                >
                  I’ve done e-KYC → Book
                </button>
              </section>
              </ScrollReveal>
            )}
            {step === "booking" && (
              <ScrollReveal>
              <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Book transport &amp; stays</h2>
                <p className="text-[var(--text-muted)] text-sm mb-2">
                  Book bus, train, hotels and restaurants — linked to our SOS safety app.
                </p>
                {safetyAddOn && (
                  <p className="text-sm text-[var(--primary)] font-medium mb-6">
                    🛡️ Safety add-on is on — your bookings will enable SOS &amp; incident response for this trip.
                  </p>
                )}
                {!safetyAddOn && <div className="mb-6" />}
                <StaggerList className="grid sm:grid-cols-2 gap-4" staggerDelay={0.08}>
                  <Link
                    href="/dashboard/book/transport"
                    className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4 hover:border-[var(--primary)] hover:bg-[var(--primary-light)]/30 transition-colors"
                  >
                    <span className="text-2xl">🚌</span>
                    <span className="font-medium text-[var(--text)]">Bus &amp; Train</span>
                  </Link>
                  <Link
                    href="/dashboard/book/hotels"
                    className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4 hover:border-[var(--primary)] hover:bg-[var(--primary-light)]/30 transition-colors"
                  >
                    <span className="text-2xl">🏨</span>
                    <span className="font-medium text-[var(--text)]">Hotels</span>
                  </Link>
                  <Link
                    href="/dashboard/book/restaurants"
                    className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4 hover:border-[var(--primary)] hover:bg-[var(--primary-light)]/30 transition-colors"
                  >
                    <span className="text-2xl">🍽️</span>
                    <span className="font-medium text-[var(--text)]">Restaurants</span>
                  </Link>
                </StaggerList>
              </section>
              </ScrollReveal>
            )}
          </>
        )}
      </main>
    </div>
  );
}
