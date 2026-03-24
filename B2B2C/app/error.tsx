"use client";

/**
 * Error boundary for the app. Catches errors in the tree and shows a fallback.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-xl font-semibold text-[var(--text)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)] text-center max-w-md">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-[var(--radius)] bg-[var(--primary)] px-5 py-2.5 font-medium text-white hover:bg-[var(--primary-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
