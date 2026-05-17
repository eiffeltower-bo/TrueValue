import { api } from "./client";

export type Presence = "no target" | "moving" | "still" | "moving+still";

export type Measurement = {
  id: number;
  sensor_id: string;
  room: string;
  temperature: string | null;
  humidity: string | null;
  presence: Presence;
  property_id: number;
  created_at: string;
};

export type VisitorEvent = {
  id: number;
  room: number;
  event: "in" | "out";
  timestamp: string;
  property_id: number;
};

export function listLatestMeasurements(propertyId: number | string): Promise<Measurement[]> {
  return api.get<Measurement[]>(`/measurements/latest?property_id=${propertyId}`);
}

export function listVisitorEvents(
  propertyId: number | string,
  since?: string,
): Promise<VisitorEvent[]> {
  const qs = new URLSearchParams({ property_id: String(propertyId) });
  if (since) qs.set("since", since);
  return api.get<VisitorEvent[]>(`/visitor-events?${qs.toString()}`);
}
