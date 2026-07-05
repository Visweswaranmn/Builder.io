import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { DEPARTMENTS, ATTENDANCE_STATUSES } from '../constants/enums.js';

/**
 * Attendance is embedded per employee: high read locality (always fetched with
 * the employee) and bounded write pattern (one entry per working day).
 */
const attendanceSchema = new Schema(
  {
    date: { type: Date, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    note: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * A workforce member. May optionally be linked to a login `User` account, and
 * is assigned to a project and a reporting manager.
 */
const employeeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    department: { type: String, enum: DEPARTMENTS, default: 'other', index: true },
    designation: { type: String, trim: true },
    salary: { type: Number, min: 0, default: 0 },
    dateOfJoining: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },

    // Optional link to an auth account — sparse+unique so at most one employee
    // record can reference a given user, but the field can stay unset.
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    // Assignment
    project: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User' },

    attendance: { type: [attendanceSchema], default: [] },
  },
  { timestamps: true },
);

export type Employee = InferSchemaType<typeof employeeSchema>;
export type EmployeeDocument = HydratedDocument<Employee>;

export const EmployeeModel = model('Employee', employeeSchema);
