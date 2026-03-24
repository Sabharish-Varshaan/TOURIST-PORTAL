"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/motion";
import { TourismImage } from "@/components/ui/TourismImage";

const LOGIN_IMAGE =
  "https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=800&q=80";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tourist/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      // Store session and redirect to dashboard (travel profile + plan flow)
      if (typeof window !== "undefined") {
        localStorage.setItem("tourist_id", data.tourist_id);
        localStorage.setItem("qr_png", data.qr_png || "");
        localStorage.setItem("tourist_name", data.name || "Tourist");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
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
          <Link href="/explore" className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
            Explore without login
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row lg:min-h-0 lg:max-w-5xl lg:mx-auto lg:w-full">
        {/* Tourism image: banner on mobile, side panel on desktop */}
        <div className="relative w-full h-48 lg:h-auto lg:w-[45%] lg:min-h-[400px] shrink-0">
          <TourismImage
            src={LOGIN_IMAGE}
            alt="Travel and sign in"
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0 lg:bg-gradient-to-r lg:from-[var(--hero-overlay)] lg:to-transparent"
            aria-hidden
          />
        </div>

        <div className="max-w-md mx-auto px-4 py-12 flex-1 lg:flex lg:items-center lg:justify-center lg:max-w-none lg:px-12">
          <div className="lg:max-w-md lg:w-full">
            <ScrollReveal>
              <h1 className="text-2xl font-bold text-[var(--text)]">Login</h1>
              <p className="mt-2 text-[var(--text-muted)]">
                Sign in to get your full travel profile and book transport &amp; stays — linked to our tourist app.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.08}>
              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-[var(--text)] mb-1">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--text)] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tourist app password"
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
            className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-6 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)] disabled:opacity-60 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </motion.button>
          </form>
        </ScrollReveal>

        <ScrollReveal delay={0.12}>
        <p className="mt-6 text-sm text-[var(--text-muted)]">
          Login uses the tourist app backend. Your profile (name, contact, email) will be loaded on the dashboard.
        </p>
        <p className="mt-3 text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-[var(--radius)] px-3 py-2 bg-[var(--bg)]">
          <strong>Demo (no backend):</strong> phone <code>demo</code> or <code>123</code>, password <code>demo</code>
        </p>
            </ScrollReveal>
          </div>
        </div>
      </main>
    </div>
  );
}
