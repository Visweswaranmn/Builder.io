import { api } from '@/lib/axios';
import type { Material, PaginationMeta, MaterialCategory, StockTransaction, StockTxnType } from '@/types/models';

export interface MaterialListParams {
  page?: number;
  limit?: number;
  category?: MaterialCategory;
  project?: string;
  vendor?: string;
  lowStockOnly?: boolean;
  search?: string;
}

export async function listMaterials(params: MaterialListParams = {}) {
  const res = await api.get<{ data: { materials: Material[]; meta: PaginationMeta } }>('/materials', { params });
  return res.data.data;
}

export async function getMaterial(id: string) {
  const res = await api.get<{ data: { material: Material } }>(`/materials/${id}`);
  return res.data.data.material;
}

export async function createMaterial(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { material: Material } }>('/materials', payload);
  return res.data.data.material;
}

export async function updateMaterial(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { material: Material } }>(`/materials/${id}`, payload);
  return res.data.data.material;
}

export async function deleteMaterial(id: string): Promise<void> {
  await api.delete(`/materials/${id}`);
}

export async function addStockTransaction(
  id: string,
  entry: { type: StockTxnType; quantity: number; note?: string },
) {
  const res = await api.post<{ data: { material: Material } }>(`/materials/${id}/stock`, entry);
  return res.data.data.material;
}

export async function getTransactions(id: string) {
  const res = await api.get<{ data: { transactions: StockTransaction[] } }>(`/materials/${id}/transactions`);
  return res.data.data.transactions;
}
