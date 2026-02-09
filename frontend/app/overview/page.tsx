"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import PricingCards from "@/components/pricing/pricing-cards"
import { PartnerMarquee } from "@/components/overview/partner-marquee"
import { fadeIn, fadeUp, stagger } from "@/components/motion/variants"

const partners = [
  { name: "Allianz Global Assistance", logoUrl: "/logos/allianz.svg" },
  { name: "World Nomads", logoUrl: "/logos/worldnomads.svg" },
  { name: "AXA Travel Insurance", logoUrl: "/logos/axa.svg" },
]

const steps = [
  {
    title: "Discover",
    description: "Get a quick overview of safety, bookings, and group travel tools.",
  },
  {
    title: "Pick a plan",
    description: "Start free or upgrade for group tracking and full trip management.",
  },
  {
    title: "Sign in",
    description: "Create your profile to unlock SOS, live maps, and bookings.",
  },
  {
    title: "Travel safely",
    description: "Use the Tourist app for live tracking, chats, and trip support.",
  },
]

const highlights = [
  {
    title: "Live safety layer",
    body: "SOS, geofencing, and instant incident response with authorities.",
  },
  {
    title: "Group traveler rooms",
    body: "Stay connected with real-time group locations and chat.",
  },
  {
    title: "Trip hub",
    body: "Book rides, stays, and dining in a single clean flow.",
  },
]

export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/overview" className="font-semibold text-slate-900">
            GuardianID
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/pricing" className="text-slate-600 hover:text-slate-900">
              Pricing
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-8 px-3 bg-slate-800 text-white hover:bg-slate-700 hover:text-white transition-all"
            >
              Login / Register
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
          >
            <div>
              <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Travel safety + booking
              </motion.p>
              <motion.h1
                variants={fadeUp}
                className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl"
              >
                A complete traveler flow, built for solo and group journeys.
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-4 text-base text-slate-600 sm:text-lg">
                GuardianID connects safety, bookings, and trip coordination in one clean experience.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  View pricing
                </Link>
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-6 bg-slate-800 text-white hover:bg-slate-700 hover:text-white transition-all"
                >
                  Login / Register
                </Link>
              </motion.div>
            </div>
            <motion.div variants={fadeIn} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4">
                {highlights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-500">{item.title}</div>
                    <div className="mt-2 text-sm text-slate-700">{item.body}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Our partners
            </p>
            <p className="mt-1 text-slate-600">Insurance and travel partners</p>
            <div className="mt-6">
              <PartnerMarquee companies={partners} />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <motion.h2 variants={fadeUp} className="text-2xl font-semibold text-slate-900">
                The GuardianID flow
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-2 text-sm text-slate-600">
                A clean, guided journey with minimal friction.
              </motion.p>
              <motion.div
                variants={stagger}
                className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
              >
                {steps.map((step, index) => (
                  <motion.div key={step.title} variants={fadeUp} className="rounded-2xl border border-slate-200 p-5">
                    <div className="text-xs font-semibold text-emerald-600">Step {index + 1}</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{step.title}</div>
                    <p className="mt-2 text-sm text-slate-600">{step.description}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <motion.h2 variants={fadeUp} className="text-2xl font-semibold text-slate-900">
                Pick your plan
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-2 text-sm text-slate-600">
                Start free. Upgrade when you need group travel and booking tools.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8">
                <PricingCards />
              </motion.div>
              <motion.div variants={fadeUp} className="mt-8 flex justify-center">
                <Button asChild size="lg">
                  <Link href="/pricing">Continue to pricing</Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <span>GuardianID © 2026</span>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-slate-700">
              Pricing
            </Link>
            <Link href="/auth" className="hover:text-slate-700">
              Login / Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
