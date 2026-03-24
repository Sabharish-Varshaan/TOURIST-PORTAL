"use client";

/**
 * Root error boundary. Required by Next.js when the root layout throws.
 * This file must define its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", margin: 0, background: "#fef7ed" }}>
        <h1 style={{ color: "#1c1917", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "#78716c", marginBottom: "1rem" }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            background: "#ea580c",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
