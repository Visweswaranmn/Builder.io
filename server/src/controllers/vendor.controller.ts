import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as vendorService from '../services/vendor.service.js';

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const { vendors, meta } = await vendorService.listVendors(req.validatedQuery ?? {});
  res.json({ success: true, data: { vendors, meta } });
});

export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getVendorById(req.params.id);
  res.json({ success: true, data: { vendor } });
});

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.createVendor(req.body);
  res.status(201).json({ success: true, message: 'Vendor created', data: { vendor } });
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.updateVendor(req.params.id, req.body);
  res.json({ success: true, message: 'Vendor updated', data: { vendor } });
});

export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  await vendorService.deleteVendor(req.params.id);
  res.json({ success: true, message: 'Vendor deleted' });
});

export const addPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.addPurchaseOrder(req.params.id, req.body);
  res.status(201).json({ success: true, message: 'Purchase order created', data: { vendor } });
});

export const listPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const purchaseOrders = await vendorService.listPurchaseOrders(req.params.id, req.validatedQuery ?? {});
  res.json({ success: true, data: { purchaseOrders } });
});

export const updatePurchaseOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.updatePurchaseOrderStatus(
    req.params.id,
    req.params.poId,
    req.body.status,
  );
  res.json({ success: true, message: 'Purchase order updated', data: { vendor } });
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const vendor = await vendorService.recordPayment(req.params.id, req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Payment recorded', data: { vendor } });
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const payments = await vendorService.listPayments(req.params.id);
  res.json({ success: true, data: { payments } });
});
