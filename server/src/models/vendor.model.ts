import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_STATUSES, PURCHASE_ORDER_STATUSES, PAYMENT_METHODS } from '../constants/enums.js';

/**
 * A single order placed with the vendor. Embedded (rather than a top-level
 * collection) since Phase 2 didn't define a standalone PurchaseOrder model —
 * this follows the same locality pattern as Employee.attendance and
 * Material.transactions.
 */
const purchaseOrderSchema = new Schema(
  {
    orderNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PURCHASE_ORDER_STATUSES, default: 'pending' },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date },
    deliveredDate: { type: Date },
  },
  { timestamps: true },
);

/** A recorded payment made to the vendor, reducing `outstandingBalance`. */
const vendorPaymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    method: { type: String, enum: PAYMENT_METHODS, default: 'bank_transfer' },
    note: { type: String, trim: true, maxlength: 300 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

/**
 * A supplier of materials/services. Tracks contact details and an aggregate
 * outstanding balance / settlement status kept in sync by the vendor service
 * as purchase orders are placed/cancelled and payments are recorded.
 */
const vendorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    companyName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    materialsSupplied: { type: [String], default: [] },

    outstandingBalance: { type: Number, min: 0, default: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    isActive: { type: Boolean, default: true },

    purchaseOrders: { type: [purchaseOrderSchema], default: [] },
    payments: { type: [vendorPaymentSchema], default: [] },
  },
  { timestamps: true },
);

export type Vendor = InferSchemaType<typeof vendorSchema>;
export type VendorDocument = HydratedDocument<Vendor>;

export const VendorModel = model('Vendor', vendorSchema);
