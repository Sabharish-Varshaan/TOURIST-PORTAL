/**
 * Report B2B2C API route timing to the GuardianID FastAPI metrics ingest (optional).
 * Set METRICS_API_KEY to match backend when METRICS_API_KEY is enabled there.
 */
const BACKEND = process.env.NEXT_PUBLIC_TOURIST_APP_API || "http://localhost:8000";
const KEY = (process.env.METRICS_API_KEY || "").trim();

export function reportB2B2CTiming(opts: {
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
}): void {
  const url = `${BACKEND.replace(/\/$/, "")}/api/metrics/ingest`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (KEY) headers["x-metrics-key"] = KEY;
  const qs = KEY ? `?key=${encodeURIComponent(KEY)}` : "";
  void fetch(`${url}${qs}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "b2b2c",
      route: opts.route,
      method: opts.method,
      status_code: opts.statusCode,
      duration_ms: Math.max(0, Math.min(opts.durationMs, 3_600_000)),
    }),
  }).catch(() => {});
}
