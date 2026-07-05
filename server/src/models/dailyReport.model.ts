import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** A logged issue observed on site during the reporting day. */
const issueSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    resolved: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * A site engineer's end-of-day progress report: media (Cloudinary URLs from
 * Phase 10), work notes, progress %, issues, weather, and labour count.
 */
const dailyReportSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    engineer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },

    workDone: { type: String, trim: true, maxlength: 3000 },
    progressPercentage: { type: Number, min: 0, max: 100, default: 0 },
    laborCount: { type: Number, min: 0, default: 0 },
    weather: { type: String, trim: true },

    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },
    issues: { type: [issueSchema], default: [] },
  },
  { timestamps: true },
);

// One engineer typically files one report per project per day.
dailyReportSchema.index({ project: 1, date: -1 });

export type DailyReport = InferSchemaType<typeof dailyReportSchema>;
export type DailyReportDocument = HydratedDocument<DailyReport>;

export const DailyReportModel = model('DailyReport', dailyReportSchema);
