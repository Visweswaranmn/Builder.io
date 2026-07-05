import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { NOTIFICATION_TYPES } from '../constants/enums.js';

/**
 * An in-app notification for a user (material low, task assigned, deadline
 * reminder, expense limit, ...). `relatedEntity` loosely links to the source
 * document so the UI can deep-link.
 */
const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'general', index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false, index: true },

    // Polymorphic reference to the entity that triggered the notification.
    relatedEntity: {
      model: { type: String },
      id: { type: Schema.Types.ObjectId },
    },
    link: { type: String, trim: true },
  },
  { timestamps: true },
);

// Fast "unread notifications for a user, newest first" lookups.
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export type Notification = InferSchemaType<typeof notificationSchema>;
export type NotificationDocument = HydratedDocument<Notification>;

export const NotificationModel = model('Notification', notificationSchema);
