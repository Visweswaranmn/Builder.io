import { api } from '@/lib/axios';
import type { Vendor, PaginationMeta, PaymentStatus, PurchaseOrderStatus, PaymentMethod } from '@/types/models';

export interface VendorListParams {
  page?: number;
  limit?: number;
  paymentStatus?: PaymentStatus;
  isActive?: boolean;
  search?: string;
}

export async function listVendors(params: VendorListParams = {}) {
  const res = await api.get<{ data: { vendors: Vendor[]; meta: PaginationMeta } }>('/vendors', { params });
  return res.data.data;
}

export async function getVendor(id: string) {
  const res = await api.get<{ data: { vendor: Vendor } }>(`/vendors/${id}`);
  return res.data.data.vendor;
}

export async function createVendor(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { vendor: Vendor } }>('/vendors', payload);
  return res.data.data.vendor;
}

export async function updateVendor(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { vendor: Vendor } }>(`/vendors/${id}`, payload);
  return res.data.data.vendor;
}

export async function deleteVendor(id: string): Promise<void> {
  await api.delete(`/vendors/${id}`);
}

export async function addPurchaseOrder(
  id: string,
  payload: { orderNumber?: string; description: string; amount: number; expectedDeliveryDate?: string },
) {
  const res = await api.post<{ data: { vendor: Vendor } }>(`/vendors/${id}/purchase-orders`, payload);
  return res.data.data.vendor;
}

export async function updatePurchaseOrderStatus(id: string, poId: string, status: PurchaseOrderStatus) {
  const res = await api.patch<{ data: { vendor: Vendor } }>(`/vendors/${id}/purchase-orders/${poId}`, { status });
  return res.data.data.vendor;
}

export async function recordVendorPayment(
  id: string,
  payload: { amount: number; method?: PaymentMethod; note?: string },
) {
  const res = await api.post<{ data: { vendor: Vendor } }>(`/vendors/${id}/payments`, payload);
  return res.data.data.vendor;
}
