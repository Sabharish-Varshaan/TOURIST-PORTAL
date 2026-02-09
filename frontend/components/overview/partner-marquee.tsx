"use client"

import { useState, useEffect } from "react"

export type PartnerCompany = {
  name: string
  logoUrl?: string
}

type PartnerMarqueeProps = {
  companies: PartnerCompany[]
}

export function PartnerMarquee({ companies }: PartnerMarqueeProps) {
  const [mounted, setMounted] = useState(false)
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set())

  useEffect(() => setMounted(true), [])

  if (companies.length === 0) return null

  const showLogo = (company: PartnerCompany) =>
    company.logoUrl && !failedLogos.has(company.logoUrl)

  const item = (company: PartnerCompany, key: string) => (
    <div
      key={key}
      className="flex shrink-0 w-[200px] items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-4 shadow-sm"
    >
      <div className="flex min-w-0 w-full flex-1 items-center justify-center">
        {showLogo(company) ? (
          <img
            src={company.logoUrl}
            alt={company.name}
            className="mx-auto block h-14 w-auto max-w-[170px] shrink-0 object-contain"
            onError={() =>
              setFailedLogos((prev) => new Set(prev).add(company.logoUrl!))
            }
          />
        ) : (
          <span className="inline-block shrink-0 text-center text-base font-semibold text-slate-700">
            {company.name}
          </span>
        )}
      </div>
    </div>
  )

  if (!mounted) {
    return (
      <div
        className="overflow-hidden -mx-4 sm:mx-0"
        style={{ minHeight: 72 }}
        aria-hidden
      />
    )
  }

  return (
    <div className="overflow-hidden -mx-4 sm:mx-0">
      <div
        className="flex w-max gap-10"
        style={{
          animation: "partner-marquee 35s linear infinite",
        }}
      >
        {companies.map((c, i) => item(c, `a-${i}`))}
        {companies.map((c, i) => item(c, `b-${i}`))}
      </div>
    </div>
  )
}
