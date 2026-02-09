import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import AppBootstrap from "@/components/app-bootstrap"

export const metadata: Metadata = {
  title: "GuardianID",
  description: "eKYC + Geofence + Live GPS Safety Platform",
  generator: "v0.app",
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppBootstrap />
        {children}
      </body>
    </html>
  )
}
