"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import TouristLogin from "@/components/tourist/login"
import TouristRegistration from "@/components/tourist/registration"
import { fadeUp, stagger } from "@/components/motion/variants"
import { useRouter } from "next/navigation"

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login")
  const router = useRouter()

  const handleLogin = (id: string, qr: string, name: string) => {
    localStorage.setItem("tourist_id", id)
    localStorage.setItem("qr_png", qr)
    localStorage.setItem("tourist_name", name)
    router.push("/tourist")
  }

  const handleRegister = (id: string, qr: string, name?: string) => {
    localStorage.setItem("tourist_id", id)
    localStorage.setItem("qr_png", qr)
    localStorage.setItem("tourist_name", name || "Tourist")
    router.push("/tourist")
  }

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
            <Button asChild size="sm" variant="outline" className="border-2 border-slate-500 bg-white text-slate-900 font-medium hover:bg-slate-100 hover:text-slate-900 hover:border-slate-600">
              <Link href="/overview">Overview</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Login / Register
            </motion.p>
            <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Access your GuardianID travel hub.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 text-base text-slate-600">
              Sign in to continue your safe travel experience or create a new profile in minutes.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-6 flex gap-3">
              <Button size="lg" onClick={() => setMode("login")} variant="outline" className={mode === "login" ? "border-2 border-slate-600 bg-slate-800 text-white font-semibold hover:bg-slate-700 hover:text-white" : "border-2 border-slate-400 bg-white text-slate-800 font-medium hover:bg-slate-100 hover:text-slate-900 hover:border-slate-500"}>
                Sign in
              </Button>
              <Button size="lg" onClick={() => setMode("register")} variant="outline" className={mode === "register" ? "border-2 border-slate-600 bg-slate-800 text-white font-semibold hover:bg-slate-700 hover:text-white" : "border-2 border-slate-400 bg-white text-slate-800 font-medium hover:bg-slate-100 hover:text-slate-900 hover:border-slate-500"}>
                Register
              </Button>
            </motion.div>
          </div>

          <div>
            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.div key="login" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}>
                  <TouristLogin onLogin={handleLogin} />
                </motion.div>
              ) : (
                <motion.div key="register" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}>
                  <TouristRegistration onRegister={handleRegister} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
