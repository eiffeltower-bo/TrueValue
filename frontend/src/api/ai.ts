import { api } from "./client";
import type { Property } from "./properties";

export type Bucket = "hot" | "warm" | "cold";
export type Confidence = "high" | "medium" | "low";

export type ScoreComponents = {
  completeness: number;
  budget_realism: number;
  engagement: number;
  intent_clarity: number;
};

export type LeadScore = {
  lead_id: number;
  score: number;
  bucket: Bucket;
  components: ScoreComponents;
  reasoning_es: string;
  next_action: string;
  matching_inventory: number;
  showings: number;
  llm_used: boolean;
};

export type Match = {
  property: Property;
  fit_score: number;
  why_es: string;
  concerns_es: string | null;
};

export type Matchmaking = {
  lead_id: number;
  matches: Match[];
  candidates_considered: number;
  llm_used: boolean;
};

export type Valuation = {
  property_id: number;
  suggested_price_usd: string;
  range_low: string;
  range_high: string;
  current_price_usd: string;
  confidence: Confidence;
  comps_count: number;
  median_price_per_m2: string | null;
  narrative_es: string;
  drivers: string[];
  llm_used: boolean;
};

export function scoreLead(leadId: number | string): Promise<LeadScore> {
  return api.post<LeadScore>(`/ai/leads/${leadId}/score`, {});
}

export function matchLead(leadId: number | string, limit = 5): Promise<Matchmaking> {
  return api.post<Matchmaking>(`/ai/leads/${leadId}/matches?limit=${limit}`, {});
}

export function valueProperty(propertyId: number | string): Promise<Valuation> {
  return api.post<Valuation>(`/ai/properties/${propertyId}/valuation`, {});
}
