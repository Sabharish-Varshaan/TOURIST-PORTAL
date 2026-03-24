"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ScrollReveal, StaggerList, AnimatedCard } from "@/components/motion";
import { TourismImage } from "@/components/ui/TourismImage";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80";
const EXPLORE_IMAGE =
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80";
const LOGIN_IMAGE =
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=600&q=80";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-card)]/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="font-semibold text-lg text-[var(--text)]">
            Tourist Booking Portal
          </span>
          <nav className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
            <Link
              href="/explore"
              className="hover:text-[var(--primary)] font-medium transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/login"
              className="text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        {/* Hero with background image and overlay */}
        <div className="relative w-full max-w-4xl mx-auto rounded-[var(--radius-lg)] overflow-hidden min-h-[280px] sm:min-h-[320px] flex items-center justify-center">
          <TourismImage
            src={HERO_IMAGE}
            alt="Travel destination"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1024px"
            className="object-cover"
          />
          <div
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: "var(--hero-overlay)" }}
          />
          <div className="relative z-10 max-w-2xl mx-auto text-center px-4">
            <ScrollReveal delay={0.1}>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight drop-shadow-md">
                Plan your trip. Get a rough budget. Book when you&apos;re ready.
              </h1>
              <p className="mt-4 text-white/90 text-lg drop-shadow-sm">
                Choose how you want to start — explore dates and budget without an account, or sign in for your full travel profile and bookings linked to our tourist safety app.
              </p>
            </ScrollReveal>
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full mt-12 text-center">
          <StaggerList className="grid sm:grid-cols-2 gap-4 sm:gap-6" staggerDelay={0.12}>
            <AnimatedCard
              as="div"
              className="group flex flex-col rounded-[var(--radius-lg)] border-2 border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-soft hover:border-[var(--primary)] text-left"
            >
              <Link href="/explore" className="flex flex-col w-full">
                <div className="relative w-full aspect-[16/10] overflow-hidden">
                  <TourismImage
                    src={EXPLORE_IMAGE}
                    alt="Explore travel destinations"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6 flex flex-col items-center text-center">
                  <span className="font-semibold text-[var(--text)]">Explore without login</span>
                  <span className="mt-2 text-sm text-[var(--text-muted)]">
                    Enter your travel dates and get a rough itinerary and budget estimate — no account needed.
                  </span>
                </div>
              </Link>
            </AnimatedCard>
            <AnimatedCard
              as="div"
              className="group flex flex-col rounded-[var(--radius-lg)] border-2 border-[var(--primary)] bg-[var(--primary)] overflow-hidden shadow-soft hover:bg-[var(--primary-hover)] text-left"
            >
              <Link href="/login" className="flex flex-col w-full">
                <div className="relative w-full aspect-[16/10] overflow-hidden">
                  <TourismImage
                    src={LOGIN_IMAGE}
                    alt="Sign in to your travel profile"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-[var(--primary)]/40" />
                </div>
                <div className="p-6 flex flex-col items-center text-center text-white">
                  <span className="font-semibold">Login</span>
                  <span className="mt-2 text-sm text-white/90">
                    Use your full travel profile, accept a plan, complete e-KYC, and book bus, train, hotels & restaurants — linked to our tourist app.
                  </span>
                </div>
              </Link>
            </AnimatedCard>
          </StaggerList>

          <ScrollReveal delay={0.2}>
            <p className="mt-10 text-sm text-[var(--text-muted)]">
              Connected to our incident management &amp; tourist safety system. Your bookings and identity stay in one place.
            </p>
          </ScrollReveal>
        </div>
      </main>

      <ScrollReveal>
        <footer className="border-t border-[var(--border)] py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-[var(--text-muted)]">
            Tourist Booking Portal · Linked to GuardianID tourist app
          </div>
        </footer>
      </ScrollReveal>
    </div>
  );
}
