import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Base URL for the incident management / tourist app backend */
export const TOURIST_APP_API =
  process.env.NEXT_PUBLIC_TOURIST_APP_API || "http://localhost:8000";
