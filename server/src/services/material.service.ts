import { FilterQuery } from 'mongoose';
import { MaterialModel, type Material, type MaterialDocument } from '../models/material.model.js';
import { ProjectModel } from '../models/project.model.js';
import { VendorModel } from '../models/vendor.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { MaterialCategory, StockTxnType } from '../constants/enums.js';
import { notifyMaterialLow } from './notification.service.js';

interface ListMaterialsInput {
  page?: number;
  limit?: number;
  category?: MaterialCategory;
  project?: string;
  vendor?: string;
  lowStockOnly?: boolean;
  search?: string;
}

const POPULATE_FIELDS = [
  { path: 'vendor', select: 'name companyName phone' },
  { path: 'project', select: 'name status' },
];

async function assertProjectExists(projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const exists = await ProjectModel.exists({ _id: projectId });
  if (!exists) throw ApiError.badRequest('project does not reference an existing project');
}

async function assertVendorExists(vendorId: string | undefined): Promise<void> {
  if (!vendorId) return;
  const exists = await VendorModel.exists({ _id: vendorId });
  if (!exists) throw ApiError.badRequest('vendor does not reference an existing vendor');
}

export async function listMaterials(
  input: ListMaterialsInput,
): Promise<{ materials: MaterialDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<Material> = {};
  if (input.category) filter.category = input.category;
  if (input.project) filter.project = input.project;
  if (input.vendor) filter.vendor = input.vendor;
  if (input.search) filter.name = new RegExp(input.search.trim(), 'i');
  // isLowStock is a virtual (not a stored field), so it needs an $expr comparison
  // against the two real fields it derives from rather than a plain filter key.
  if (input.lowStockOnly) {
    filter.$expr = { $lte: ['$quantityInStock', '$lowStockThreshold'] };
  }

  const [materials, total] = await Promise.all([
    MaterialModel.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    MaterialModel.countDocuments(filter),
  ]);

  return { materials, meta: buildPaginationMeta(pagination, total) };
}

export async function getMaterialById(id: string): Promise<MaterialDocument> {
  const material = await MaterialModel.findById(id).populate(POPULATE_FIELDS);
  if (!material) throw ApiError.notFound('Material not found');
  return material;
}

export async function createMaterial(input: Partial<Material>): Promise<MaterialDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertVendorExists(input.vendor?.toString()),
  ]);

  const material = await MaterialModel.create(input);
  return material.populate(POPULATE_FIELDS);
}

export async function updateMaterial(
  id: string,
  input: Partial<Material>,
): Promise<MaterialDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertVendorExists(input.vendor?.toString()),
  ]);

  const material = await MaterialModel.findById(id);
  if (!material) throw ApiError.notFound('Material not found');

  Object.assign(material, input);
  await material.save();

  return material.populate(POPULATE_FIELDS);
}

export async function deleteMaterial(id: string): Promise<void> {
  const material = await MaterialModel.findByIdAndDelete(id);
  if (!material) throw ApiError.notFound('Material not found');
}

/**
 * Records a stock movement and keeps `quantityInStock` in sync with the
 * ledger. Stock-out is rejected if it would drive the quantity negative.
 */
export async function addStockTransaction(
  materialId: string,
  entry: { type: StockTxnType; quantity: number; date?: Date; note?: string },
  recordedBy: string,
): Promise<MaterialDocument> {
  const material = await MaterialModel.findById(materialId);
  if (!material) throw ApiError.notFound('Material not found');

  if (entry.type === 'out' && entry.quantity > material.quantityInStock) {
    throw ApiError.badRequest(
      `Insufficient stock: only ${material.quantityInStock} ${material.unit} available`,
    );
  }

  material.quantityInStock += entry.type === 'in' ? entry.quantity : -entry.quantity;
  material.transactions.push({ ...entry, recordedBy });
  await material.save();

  if (material.quantityInStock <= material.lowStockThreshold) {
    await notifyMaterialLow(material);
  }

  return material.populate(POPULATE_FIELDS);
}

export type StockTransaction = Material['transactions'][number];

export async function getTransactions(
  materialId: string,
  range: { from?: Date; to?: Date },
): Promise<StockTransaction[]> {
  const material = await MaterialModel.findById(materialId);
  if (!material) throw ApiError.notFound('Material not found');

  return material.transactions
    .filter((t) => (!range.from || t.date >= range.from) && (!range.to || t.date <= range.to))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
