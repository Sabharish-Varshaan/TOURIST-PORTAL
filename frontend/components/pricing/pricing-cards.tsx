import Link from "next/link"
import { Button } from "@/components/ui/button"

type PricingPlan = {
  name: string
  price: string
  tagline: string
  cta: string
  ctaHref: string
  highlighted?: boolean
  features: string[]
}

const plans: PricingPlan[] = [
  {
    name: "Basic",
    price: "Free",
    tagline: "For solo travelers getting started",
    cta: "Get started",
    ctaHref: "/tourist",
    features: [
      "QR ID and registration",
      "SOS + check-ins",
      "Live map and geofence alerts",
      "Authority chat (text)",
      "Basic eKYC verification",
    ],
  },
  {
    name: "Premium",
    price: "INR 99 / trip",
    tagline: "For groups and full travel management",
    cta: "Upgrade to Premium",
    ctaHref: "/tourist",
    highlighted: true,
    features: [
      "Group rooms and member tracking",
      "Live group map sharing",
      "Offline maps and navigation",
      "Full booking flow (stay, ride, dine)",
      "Trip insurance add-on (optional)",
      "Trip history and receipts",
    ],
  },
]

export default function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={`rounded-2xl border p-6 shadow-sm ${
            plan.highlighted
              ? "border-slate-200 bg-white ring-1 ring-slate-200"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="mb-5">
            <div className="text-sm uppercase tracking-wide text-slate-500">{plan.name}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{plan.price}</div>
            <p className="mt-2 text-sm text-slate-600">{plan.tagline}</p>
          </div>

          <Button
            asChild
            size="lg"
            className={
              plan.highlighted
                ? "w-full text-white"
                : "w-full bg-slate-900 text-white hover:bg-slate-800"
            }
            variant="default"
          >
            <Link href={plan.ctaHref}>{plan.cta}</Link>
          </Button>

          <div className="mt-6 space-y-2 text-sm text-slate-700">
            {plan.features.map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
