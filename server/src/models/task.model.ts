import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { TASK_STATUSES, PRIORITIES } from '../constants/enums.js';

/**
 * A unit of work within a project, assigned to an employee and tracked by
 * status, priority, deadline, and completion percentage.
 */
const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    priority: { type: String, enum: PRIORITIES, default: 'medium', index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'todo', index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },

    startDate: { type: Date },
    deadline: { type: Date, index: true },
    completedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// Keep progress and status consistent when a task is completed.
taskSchema.pre('save', function (next) {
  if (this.status === 'completed') {
    this.progress = 100;
    if (!this.completedAt) this.completedAt = new Date();
  }
  next();
});

taskSchema.virtual('isOverdue').get(function () {
  return Boolean(this.deadline && this.status !== 'completed' && this.deadline < new Date());
});

export type Task = InferSchemaType<typeof taskSchema>;
export type TaskDocument = HydratedDocument<Task>;

export const TaskModel = model('Task', taskSchema);
