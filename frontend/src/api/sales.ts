import { api } from "./client";

export const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type Sale = {
  id: number;
  product_or_service: string;
  amount: string;
  payment_method: string;
  location: string;
  agent_id: number;
  sold_at: string;
};

export type SaleCreatePayload = {
  product_or_service: string;
  amount: number;
  payment_method: PaymentMethod;
  location: string;
  agent_id: number;
};

export function listSales(): Promise<Sale[]> {
  return api.get<Sale[]>("/sales");
}

export function createSale(payload: SaleCreatePayload): Promise<Sale> {
  return api.post<Sale>("/sales", payload);
}
