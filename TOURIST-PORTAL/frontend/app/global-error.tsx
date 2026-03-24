"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: "2rem", background: "#0f172a", color: "#e2e8f0", minHeight: "100vh" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ marginBottom: "1rem", color: "#94a3b8" }}>
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1rem" }}>
            Digest: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.5rem 1rem",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
