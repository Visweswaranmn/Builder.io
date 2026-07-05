import { FilterQuery } from 'mongoose';
import { VendorModel, type Vendor, type VendorDocument } from '../models/vendor.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { PaymentStatus, PurchaseOrderStatus, PaymentMethod } from '../constants/enums.js';

interface ListVendorsInput {
  page?: number;
  limit?: number;
  paymentStatus?: PaymentStatus;
  isActive?: boolean;
  search?: string;
}

/** Recomputes the aggregate settlement status from the current balance/history. */
function recomputePaymentStatus(vendor: VendorDocument): void {
  if (vendor.outstandingBalance <= 0) {
    vendor.paymentStatus = 'paid';
  } else if (vendor.payments.length > 0) {
    vendor.paymentStatus = 'partial';
  } else {
    vendor.paymentStatus = 'pending';
  }
}

export async function listVendors(
  input: ListVendorsInput,
): Promise<{ vendors: VendorDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<Vendor> = {};
  if (input.paymentStatus) filter.paymentStatus = input.paymentStatus;
  if (input.isActive !== undefined) filter.isActive = input.isActive;
  if (input.search) {
    const regex = new RegExp(input.search.trim(), 'i');
    filter.$or = [{ name: regex }, { companyName: regex }, { gstNumber: regex }];
  }

  const [vendors, total] = await Promise.all([
    VendorModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    VendorModel.countDocuments(filter),
  ]);

  return { vendors, meta: buildPaginationMeta(pagination, total) };
}

export async function getVendorById(id: string): Promise<VendorDocument> {
  const vendor = await VendorModel.findById(id);
  if (!vendor) throw ApiError.notFound('Vendor not found');
  return vendor;
}

export async function createVendor(input: Partial<Vendor>): Promise<VendorDocument> {
  return VendorModel.create(input);
}

export async function updateVendor(id: string, input: Partial<Vendor>): Promise<VendorDocument> {
  const vendor = await VendorModel.findById(id);
  if (!vendor) throw ApiError.notFound('Vendor not found');

  Object.assign(vendor, input);
  await vendor.save();
  return vendor;
}

export async function deleteVendor(id: string): Promise<void> {
  const vendor = await VendorModel.findByIdAndDelete(id);
  if (!vendor) throw ApiError.notFound('Vendor not found');
}

export type PurchaseOrder = Vendor['purchaseOrders'][number];

/** Placing an order increases what we owe the vendor for it. */
export async function addPurchaseOrder(
  vendorId: string,
  input: { orderNumber?: string; description: string; amount: number; expectedDeliveryDate?: Date },
): Promise<VendorDocument> {
  const vendor = await VendorModel.findById(vendorId);
  if (!vendor) throw ApiError.notFound('Vendor not found');

  vendor.purchaseOrders.push({ ...input, status: 'pending' });
  vendor.outstandingBalance += input.amount;
  recomputePaymentStatus(vendor);
  await vendor.save();

  return vendor;
}

export async function listPurchaseOrders(
  vendorId: string,
  filter: { status?: PurchaseOrderStatus },
): Promise<PurchaseOrder[]> {
  const vendor = await VendorModel.findById(vendorId);
  if (!vendor) throw ApiError.notFound('Vendor not found');

  return vendor.purchaseOrders
    .filter((po) => !filter.status || po.status === filter.status)
    .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
}

const TERMINAL_STATUSES: PurchaseOrderStatus[] = ['delivered', 'cancelled'];
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  pending: ['ordered', 'cancelled'],
  ordered: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * Advances a purchase order's status. Cancelling reverses its amount out of
 * `outstandingBalance` (we no longer owe for it); delivering stamps
 * `deliveredDate`. Once delivered or cancelled, a PO is terminal.
 */
export async function updatePurchaseOrderStatus(
  vendorId: string,
  purchaseOrderId: string,
  newStatus: PurchaseOrderStatus,
): Promise<VendorDocument> {
  const vendor = await VendorModel.findById(vendorId);
  if (!vendor) throw ApiError.notFound('Vendor not found');

  const po = vendor.purchaseOrders.id(purchaseOrderId);
  if (!po) throw ApiError.notFound('Purchase order not found');

  if (TERMINAL_STATUSES.includes(po.status as PurchaseOrderStatus)) {
    throw ApiError.badRequest(`Cannot change a purchase order that is already ${po.status}`);
  }
  if (!ALLOWED_TRANSITIONS[po.status as PurchaseOrderStatus].includes(newStatus)) {
    throw ApiError.badRequest(`Cannot move a purchase order from ${po.status} to ${newStatus}`);
  }

  if (newStatus === 'cancelled') {
    vendor.outstandingBalance = Math.max(0, vendor.outstandingBalance - po.amount);
    recomputePaymentStatus(vendor);
  } else if (newStatus === 'delivered') {
    po.deliveredDate = new Date();
  }

  po.status = newStatus;
  await vendor.save();

  return vendor;
}

/** Records a payment to the vendor, reducing the outstanding balance. */
export async function recordPayment(
  vendorId: string,
  input: { amount: number; date?: Date; method?: PaymentMethod; note?: string },
  recordedBy: string,
): Promise<VendorDocument> {
  const vendor = await VendorModel.findById(vendorId);
  if (!vendor) throw ApiError.notFound('Vendor not found');

  if (input.amount > vendor.outstandingBalance) {
    throw ApiError.badRequest(
      `Payment exceeds the outstanding balance of ${vendor.outstandingBalance}`,
    );
  }

  vendor.payments.push({ ...input, recordedBy });
  vendor.outstandingBalance -= input.amount;
  recomputePaymentStatus(vendor);
  await vendor.save();

  return vendor;
}

export type VendorPayment = Vendor['payments'][number];

export async function listPayments(vendorId: string): Promise<VendorPayment[]> {
  const vendor = await VendorModel.findById(vendorId);
  if (!vendor) throw ApiError.notFound('Vendor not found');

  return [...vendor.payments].sort((a, b) => b.date.getTime() - a.date.getTime());
}
