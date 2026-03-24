"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import PricingCards from "@/components/pricing/pricing-cards"
import { fadeUp, stagger } from "@/components/motion/variants"

const faqs = [
  {
    question: "Is the Basic plan really free?",
    answer: "Yes. Basic includes registration, SOS, and live safety tools with no cost.",
  },
  {
    question: "How does trip insurance work?",
    answer: "Insurance is optional at checkout. You can opt in per trip and pay a small add-on fee.",
  },
  {
    question: "What does Premium unlock?",
    answer: "Premium adds group travel rooms, live group maps, offline navigation, and full booking tools.",
  },
  {
    question: "Can I upgrade later?",
    answer: "Yes. Start with Basic and upgrade any time before or during a trip.",
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-semibold text-slate-900">
            GuardianID
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-slate-600 hover:text-slate-900">
              Home
            </Link>
            <Button asChild size="sm" variant="outline" className="border-slate-200 text-slate-800 hover:bg-slate-100">
              <Link href="/tourist">Open App</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-2xl">
            <motion.p variants={fadeUp} className="text-sm uppercase tracking-wide text-slate-500">
              Pricing
            </motion.p>
            <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Simple pricing for safe, complete travel.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-slate-600">
              Start with safety essentials for free. Upgrade when you need group travel, bookings, and trip insurance.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth">Continue to Login / Register</Link>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <motion.div variants={fadeUp} className="mb-10">
                <h2 className="text-3xl font-semibold">Plans for travelers</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Transparent pricing designed for individuals and groups.
                </p>
              </motion.div>
              <motion.div variants={fadeUp}>
                <PricingCards />
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <motion.h2 variants={fadeUp} className="text-2xl font-semibold">
                FAQs
              </motion.h2>
              <motion.div variants={stagger} className="mt-8 grid gap-6 md:grid-cols-2">
                {faqs.map((faq) => (
                  <motion.div
                    key={faq.question}
                    variants={fadeUp}
                    className="rounded-2xl border border-slate-200 bg-white p-6"
                  >
                    <div className="text-sm font-semibold text-slate-900">{faq.question}</div>
                    <p className="mt-2 text-sm text-slate-600">{faq.answer}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <span>GuardianID © 2026</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-slate-700">
              Home
            </Link>
            <Link href="/tourist" className="hover:text-slate-700">
              Open App
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
