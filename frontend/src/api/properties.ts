import { api } from "./client";

// Values match what the seed data inserts so create-flows produce rows
// consistent with what filters/dropdowns see on existing data.
export const PROPERTY_TYPES = [
  "Departamento",
  "Casa",
  "Terreno",
  "Oficina",
  "Local comercial",
  "Galpón",
  "Quinta",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const LISTING_TYPES = ["venta", "alquiler", "anticretico"] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LEGAL_STATUSES = [
  "saneado",
  "en_tramite",
  "con_observaciones",
  "pendiente",
] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export type Property = {
  id: number;
  title: string;
  price: string;
  property_type: string;
  location: string;
  agent_id: number;
  created_at: string;

  area_total_m2: number | null;
  area_construida_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  floors: number | null;
  year_built: number | null;
  listing_type: ListingType;
  legal_status: LegalStatus | null;
  utilities: string[];
  amenities: string[];
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

export function getProperty(id: number | string): Promise<Property> {
  return api.get<Property>(`/properties/${id}`);
}

export function createProperty(payload: PropertyCreatePayload): Promise<Property> {
  return api.post<Property>("/properties", payload);
}
