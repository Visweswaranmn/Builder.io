import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PROJECT_STATUSES } from '../constants/enums.js';

/**
 * A construction project — the central entity most other collections reference.
 */
const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150, index: true },
    client: { type: String, required: true, trim: true },
    budget: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String, trim: true },
    status: { type: String, enum: PROJECT_STATUSES, default: 'planning', index: true },
    description: { type: String, trim: true, maxlength: 2000 },
    progress: { type: Number, min: 0, max: 100, default: 0 },

    // The project manager responsible (User with role project_manager/super_admin)
    manager: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true },
);

// Guard: end date cannot precede start date.
projectSchema.pre('validate', function (next) {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
  next();
});

export type Project = InferSchemaType<typeof projectSchema>;
export type ProjectDocument = HydratedDocument<Project>;

export const ProjectModel = model('Project', projectSchema);
