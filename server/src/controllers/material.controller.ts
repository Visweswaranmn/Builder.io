import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as materialService from '../services/material.service.js';

export const listMaterials = asyncHandler(async (req: Request, res: Response) => {
  const { materials, meta } = await materialService.listMaterials(req.validatedQuery ?? {});
  res.json({ success: true, data: { materials, meta } });
});

export const getMaterial = asyncHandler(async (req: Request, res: Response) => {
  const material = await materialService.getMaterialById(req.params.id);
  res.json({ success: true, data: { material } });
});

export const createMaterial = asyncHandler(async (req: Request, res: Response) => {
  const material = await materialService.createMaterial(req.body);
  res.status(201).json({ success: true, message: 'Material created', data: { material } });
});

export const updateMaterial = asyncHandler(async (req: Request, res: Response) => {
  const material = await materialService.updateMaterial(req.params.id, req.body);
  res.json({ success: true, message: 'Material updated', data: { material } });
});

export const deleteMaterial = asyncHandler(async (req: Request, res: Response) => {
  await materialService.deleteMaterial(req.params.id);
  res.json({ success: true, message: 'Material deleted' });
});

export const addStockTransaction = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const material = await materialService.addStockTransaction(req.params.id, req.body, req.user.id);
  res.status(201).json({
    success: true,
    message: 'Stock transaction recorded',
    data: { material },
  });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await materialService.getTransactions(req.params.id, req.validatedQuery ?? {});
  res.json({ success: true, data: { transactions } });
});
