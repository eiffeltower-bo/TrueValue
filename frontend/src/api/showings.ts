import { api } from "./client";

export type ShowingSource = "manual" | "qr" | "appointment";

export type Showing = {
  id: number;
  lead_id: number;
  property_id: number;
  agent_id: number | null;
  started_at: string;
  ended_at: string | null;
  source: ShowingSource;
};

export type ShowingCreatePayload = {
  lead_id: number;
  property_id: number;
  agent_id?: number | null;
  source?: ShowingSource;
};

export type ListShowingsParams = {
  lead_id?: number;
  property_id?: number;
  open_only?: boolean;
};

export function listShowings(params: ListShowingsParams = {}): Promise<Showing[]> {
  const qs = new URLSearchParams();
  if (params.lead_id != null) qs.set("lead_id", String(params.lead_id));
  if (params.property_id != null) qs.set("property_id", String(params.property_id));
  if (params.open_only) qs.set("open_only", "true");
  const tail = qs.toString();
  return api.get<Showing[]>(`/showings${tail ? `?${tail}` : ""}`);
}

export function startShowing(payload: ShowingCreatePayload): Promise<Showing> {
  return api.post<Showing>("/showings", payload);
}

export function endShowing(id: number): Promise<Showing> {
  return api.post<Showing>(`/showings/${id}/end`, {});
}
