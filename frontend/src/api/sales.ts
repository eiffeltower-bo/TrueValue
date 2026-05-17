import { api } from "./client";

// Values match the labels the seed data inserts (mirrors HIGH_VALUE_PAYMENTS
// + SERVICE_PAYMENTS in backend/app/seed/bolivia_data.py) so create-flows
// produce rows consistent with existing data.
export const PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia bancaria",
  "Tarjeta de crédito",
  "Tarjeta de débito",
  "QR Banco Unión",
  "QR BCP",
  "QR Mercantil Santa Cruz",
  "QR BISA",
  "Cheque",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type Sale = {
  id: number;
  product_or_service: string;
  amount: string;
  payment_method: string;
  location: string;
  agent_id: number;
  sold_at: string;
  property_id: number | null;
};

export type SaleCreatePayload = {
  product_or_service: string;
  amount: number;
  payment_method: PaymentMethod;
  location: string;
  agent_id: number;
  property_id?: number | null;
};

export function listSales(): Promise<Sale[]> {
  return api.get<Sale[]>("/sales");
}

export function createSale(payload: SaleCreatePayload): Promise<Sale> {
  return api.post<Sale>("/sales", payload);
}
