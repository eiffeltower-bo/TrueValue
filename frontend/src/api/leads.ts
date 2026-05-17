import { api } from "./client";

export const LEAD_INTENTS = ["venta", "alquiler", "anticretico"] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "visiting",
  "negotiating",
  "closed",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["walk_in", "referral", "web", "open_house", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export type Lead = {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;

  agent_id: number | null;
  status: LeadStatus;

  intent: LeadIntent;
  budget_min_usd: string | null;
  budget_max_usd: string | null;
  zonas: string[];
  bedrooms_min: number | null;
  area_min_m2: number | null;
  must_haves: string[];
  notes: string;

  created_at: string;
};

export type LeadCreatePayload = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  source?: LeadSource;
  agent_id?: number | null;
  status?: LeadStatus;
  intent?: LeadIntent;
  budget_min_usd?: number | null;
  budget_max_usd?: number | null;
  zonas?: string[];
  bedrooms_min?: number | null;
  area_min_m2?: number | null;
  must_haves?: string[];
  notes?: string;
};

export type LeadUpdatePayload = Partial<LeadCreatePayload>;

export function listLeads(): Promise<Lead[]> {
  return api.get<Lead[]>("/leads");
}

export function getLead(id: number | string): Promise<Lead> {
  return api.get<Lead>(`/leads/${id}`);
}

export function createLead(payload: LeadCreatePayload): Promise<Lead> {
  return api.post<Lead>("/leads", payload);
}

export function updateLead(id: number | string, payload: LeadUpdatePayload): Promise<Lead> {
  return api.patch<Lead>(`/leads/${id}`, payload);
}
