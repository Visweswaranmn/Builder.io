import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { MATERIAL_CATEGORIES, STOCK_TXN_TYPES } from '../constants/enums.js';

/**
 * Embedded stock ledger entry — each stock-in / stock-out movement is recorded
 * so quantity changes are auditable.
 */
const stockTxnSchema = new Schema(
  {
    type: { type: String, enum: STOCK_TXN_TYPES, required: true },
    quantity: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

/**
 * An inventory item (cement, steel, sand, ...). `isLowStock` is a virtual
 * derived from the current quantity vs. the configured threshold.
 */
const materialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    category: { type: String, enum: MATERIAL_CATEGORIES, default: 'other', index: true },
    unit: { type: String, required: true, trim: true, default: 'unit' }, // bag, ton, m3, ...
    quantityInStock: { type: Number, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 10 },
    unitPrice: { type: Number, min: 0, default: 0 },

    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', index: true },

    transactions: { type: [stockTxnSchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

materialSchema.virtual('isLowStock').get(function () {
  return this.quantityInStock <= this.lowStockThreshold;
});

export type Material = InferSchemaType<typeof materialSchema>;
export type MaterialDocument = HydratedDocument<Material>;

export const MaterialModel = model('Material', materialSchema);
