// Serializable shapes the server page (app/admin/(preview)/new-version/page.tsx)
// builds and hands to the client DashboardV2 tree. No Date/Decimal cross the
// boundary — dates are pre-formatted to strings server-side.
import type { MetricTone } from "../types";

export interface MetricV2 {
  key: string;
  href: string;
  /** Compact label shown under the count. */
  label: string;
  count: number;
  tone: MetricTone;
  /** count > 0 on an actionable tone — drives the ping / warn marker. */
  urgent: boolean;
}

export type AppointmentStatusKey =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface TodayItem {
  id: string;
  href: string;
  /** Pre-formatted start time, e.g. "14:30". */
  time: string;
  customer: string;
  service: string | null;
  status: AppointmentStatusKey;
}
