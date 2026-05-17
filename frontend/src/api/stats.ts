import { api } from "./client";

export type RangeKey = "30d" | "90d" | "365d";
export type GroupByKey = "property_type" | "listing_type";

export type SalesOverTimeBucket = {
  date: string; // YYYY-MM-DD
  series: Record<string, number>;
};

export type SalesOverTimeResponse = {
  range: RangeKey;
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
  range: RangeKey;
  total_usd: number;
  count: number;
  by_kind: Record<string, number>;
};

export type ConversionRateResponse = {
  range: RangeKey;
  listings_total: number;
  listings_sold: number;
  rate: number; // 0..1
};

export function fetchSalesOverTime(
  range: RangeKey,
  groupBy: GroupByKey,
): Promise<SalesOverTimeResponse> {
  const qs = new URLSearchParams({ range, group_by: groupBy }).toString();
  return api.get<SalesOverTimeResponse>(`/stats/sales-over-time?${qs}`);
}

export function fetchInventory(): Promise<InventoryResponse> {
  return api.get<InventoryResponse>("/stats/inventory");
}

export function fetchTopAgents(range: RangeKey, limit = 5): Promise<TopAgentEntry[]> {
  const qs = new URLSearchParams({ range, limit: String(limit) }).toString();
  return api.get<TopAgentEntry[]>(`/stats/top-agents?${qs}`);
}

export function fetchHotNeighborhoods(
  city: string,
  range: RangeKey,
  limit = 5,
): Promise<HotNeighborhoodEntry[]> {
  const qs = new URLSearchParams({ city, range, limit: String(limit) }).toString();
  return api.get<HotNeighborhoodEntry[]>(`/stats/hot-neighborhoods?${qs}`);
}

export function fetchCommissions(range: RangeKey): Promise<CommissionsResponse> {
  const qs = new URLSearchParams({ range }).toString();
  return api.get<CommissionsResponse>(`/stats/commissions?${qs}`);
}

export function fetchConversionRate(range: RangeKey): Promise<ConversionRateResponse> {
  const qs = new URLSearchParams({ range }).toString();
  return api.get<ConversionRateResponse>(`/stats/conversion?${qs}`);
}

export const CITIES: readonly string[] = ["La Paz", "Santa Cruz", "Cochabamba"];

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "365d", label: "1y" },
];
