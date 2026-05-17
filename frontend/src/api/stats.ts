import { api } from "./client";

export type RangePreset = "30d" | "90d" | "365d";
export type GroupByKey = "property_type" | "listing_type";

// A dashboard window — either a preset (last N days) or a closed custom
// interval expressed as ISO dates (YYYY-MM-DD). Backend endpoints accept
// either `range=` or `start_date=&end_date=`.
export type DashboardWindow =
  | { kind: "preset"; preset: RangePreset }
  | { kind: "custom"; startDate: string; endDate: string };

export type SalesOverTimeBucket = {
  date: string; // YYYY-MM-DD
  series: Record<string, number>;
};

export type SalesOverTimeResponse = {
  range: string; // "30d" | "90d" | "365d" | "custom"
  start_date: string;
  end_date: string;
  group_by: GroupByKey;
  keys: string[];
  buckets: SalesOverTimeBucket[];
  totals: Record<string, number>;
};

export type InventoryResponse = {
  total: number;
  by_type: Record<string, number>;
  by_listing_type: Record<string, number>;
};

export type TopAgentEntry = {
  agent_id: number;
  full_name: string;
  sales_count: number;
  sales_total_usd: number;
};

export type HotNeighborhoodEntry = {
  zona: string;
  sales_count: number;
  sales_total_usd: number;
};

export type CommissionsResponse = {
  range: string;
  start_date: string;
  end_date: string;
  total_usd: number;
  count: number;
  by_kind: Record<string, number>;
};

export type ConversionRateResponse = {
  range: string;
  start_date: string;
  end_date: string;
  listings_total: number;
  listings_sold: number;
  rate: number; // 0..1
};

export type LeadsCountResponse = {
  range: string;
  start_date: string;
  end_date: string;
  total: number;
  open: number;
  by_status: Record<string, number>;
};

/** Encode a DashboardWindow as URLSearchParams the stats endpoints accept. */
export function windowParams(window: DashboardWindow): URLSearchParams {
  const qs = new URLSearchParams();
  if (window.kind === "preset") {
    qs.set("range", window.preset);
  } else {
    qs.set("start_date", window.startDate);
    qs.set("end_date", window.endDate);
  }
  return qs;
}

/** Human-readable label for a window (used in card subtitles). */
export function windowLabel(window: DashboardWindow): string {
  if (window.kind === "preset") return window.preset;
  return `${window.startDate} → ${window.endDate}`;
}

/** Stable cache key for useEffect deps based on the current window. */
export function windowKey(window: DashboardWindow): string {
  return window.kind === "preset"
    ? `p:${window.preset}`
    : `c:${window.startDate}:${window.endDate}`;
}

export function fetchSalesOverTime(
  window: DashboardWindow,
  groupBy: GroupByKey,
): Promise<SalesOverTimeResponse> {
  const qs = windowParams(window);
  qs.set("group_by", groupBy);
  return api.get<SalesOverTimeResponse>(`/stats/sales-over-time?${qs.toString()}`);
}

export function fetchInventory(): Promise<InventoryResponse> {
  return api.get<InventoryResponse>("/stats/inventory");
}

export function fetchTopAgents(window: DashboardWindow, limit = 5): Promise<TopAgentEntry[]> {
  const qs = windowParams(window);
  qs.set("limit", String(limit));
  return api.get<TopAgentEntry[]>(`/stats/top-agents?${qs.toString()}`);
}

export function fetchHotNeighborhoods(
  city: string,
  window: DashboardWindow,
  limit = 5,
): Promise<HotNeighborhoodEntry[]> {
  const qs = windowParams(window);
  qs.set("city", city);
  qs.set("limit", String(limit));
  return api.get<HotNeighborhoodEntry[]>(`/stats/hot-neighborhoods?${qs.toString()}`);
}

export function fetchCommissions(window: DashboardWindow): Promise<CommissionsResponse> {
  const qs = windowParams(window);
  return api.get<CommissionsResponse>(`/stats/commissions?${qs.toString()}`);
}

export function fetchConversionRate(window: DashboardWindow): Promise<ConversionRateResponse> {
  const qs = windowParams(window);
  return api.get<ConversionRateResponse>(`/stats/conversion?${qs.toString()}`);
}

export function fetchLeadsCount(window: DashboardWindow): Promise<LeadsCountResponse> {
  const qs = windowParams(window);
  return api.get<LeadsCountResponse>(`/stats/leads-count?${qs.toString()}`);
}

export const CITIES: readonly string[] = ["La Paz", "Santa Cruz", "Cochabamba"];

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "365d", label: "1a" },
];
