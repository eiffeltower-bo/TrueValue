import { api } from "./client";

export const PROPERTY_TYPES = ["apartment", "house", "land", "office"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type Property = {
  id: number;
  title: string;
  price: string;
  property_type: string;
  location: string;
  agent_id: number;
  created_at: string;
};

export type PropertyCreatePayload = {
  title: string;
  price: number;
  property_type: PropertyType;
  location: string;
  agent_id: number;
};

export function listProperties(): Promise<Property[]> {
  return api.get<Property[]>("/properties");
}

export function createProperty(payload: PropertyCreatePayload): Promise<Property> {
  return api.post<Property>("/properties", payload);
}
