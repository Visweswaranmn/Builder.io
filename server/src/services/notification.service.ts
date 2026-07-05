import { NotificationModel, type NotificationDocument } from '../models/notification.model.js';
import { UserModel } from '../models/user.model.js';
import { TaskModel } from '../models/task.model.js';
import { ProjectModel } from '../models/project.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { NotificationType } from '../constants/enums.js';

interface ListNotificationsInput {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
}

/**
 * Low-level notification creator used internally by other services (material
 * low-stock, task assignment, expense limit, deadline reminders). Not exposed
 * directly over HTTP — a public "create notification for anyone" endpoint
 * would let any user spam any other user.
 */
export async function notify(input: {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntity?: { model: string; id: string };
  link?: string;
}): Promise<NotificationDocument> {
  return NotificationModel.create(input);
}

export async function notifyMany(
  recipients: string[],
  input: Omit<Parameters<typeof notify>[0], 'recipient'>,
): Promise<void> {
  const uniqueRecipients = [...new Set(recipients)];
  await Promise.all(uniqueRecipients.map((recipient) => notify({ ...input, recipient })));
}

/** Every active super_admin — the default audience for system-wide alerts. */
export async function getSuperAdminIds(): Promise<string[]> {
  const admins = await UserModel.find({ role: 'super_admin', isActive: true }).select('_id');
  return admins.map((a) => a._id.toString());
}

/** Everything a signed-in user needs to see: their own notifications, paginated. */
export async function listNotifications(
  userId: string,
  input: ListNotificationsInput,
): Promise<{ notifications: NotificationDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: Record<string, unknown> = { recipient: userId };
  if (input.isRead !== undefined) filter.isRead = input.isRead;
  if (input.type) filter.type = input.type;

  const [notifications, total] = await Promise.all([
    NotificationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    NotificationModel.countDocuments(filter),
  ]);

  return { notifications, meta: buildPaginationMeta(pagination, total) };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return NotificationModel.countDocuments({ recipient: userId, isRead: false });
}

/**
 * Fetches a notification and verifies it belongs to `userId`. Returns 404
 * (not 403) on an ownership mismatch so a caller can't distinguish "doesn't
 * exist" from "belongs to someone else".
 */
async function getOwnNotification(userId: string, id: string): Promise<NotificationDocument> {
  const notification = await NotificationModel.findById(id);
  if (!notification || notification.recipient.toString() !== userId) {
    throw ApiError.notFound('Notification not found');
  }
  return notification;
}

export async function markAsRead(userId: string, id: string): Promise<NotificationDocument> {
  const notification = await getOwnNotification(userId, id);
  notification.isRead = true;
  await notification.save();
  return notification;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await NotificationModel.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true } },
  );
  return result.modifiedCount;
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  const notification = await getOwnNotification(userId, id);
  await notification.deleteOne();
}

// ---- Event-specific helpers, called by other services ----

export async function notifyMaterialLow(material: {
  _id: unknown;
  name: string;
  quantityInStock: number;
  unit: string;
  project?: unknown;
}): Promise<void> {
  const recipients = await getSuperAdminIds();

  if (material.project) {
    const project = await ProjectModel.findById(material.project).select('manager');
    if (project?.manager) recipients.push(project.manager.toString());
  }

  await notifyMany(recipients, {
    type: 'material_low',
    title: 'Low stock alert',
    message: `${material.name} is low on stock: ${material.quantityInStock} ${material.unit} remaining.`,
    relatedEntity: { model: 'Material', id: String(material._id) },
  });
}

export async function notifyTaskAssigned(task: {
  _id: unknown;
  title: string;
  deadline?: Date | null;
}, employeeUserId: string): Promise<void> {
  await notify({
    recipient: employeeUserId,
    type: 'task_assigned',
    title: 'New task assigned',
    message: `You have been assigned: ${task.title}${task.deadline ? ` (due ${task.deadline.toDateString()})` : ''}.`,
    relatedEntity: { model: 'Task', id: String(task._id) },
  });
}

export async function notifyExpenseLimit(project: {
  _id: unknown;
  name: string;
  budget: number;
  manager?: unknown;
}, actualSpend: number): Promise<void> {
  const recipients = await getSuperAdminIds();
  if (project.manager) recipients.push(project.manager.toString());

  await notifyMany(recipients, {
    type: 'expense_limit',
    title: 'Project over budget',
    message: `${project.name} has spent ${actualSpend} against a budget of ${project.budget}.`,
    relatedEntity: { model: 'Project', id: String(project._id) },
  });
}

/**
 * Scans for tasks with a deadline in the next 48 hours (not yet completed)
 * and creates a `deadline_reminder` for each assigned employee's linked user
 * account — deduped so re-running this doesn't spam the same reminder.
 * Intended to be invoked periodically by a scheduler (cron, Task Scheduler,
 * cloud scheduler); exposed here as an admin-triggered endpoint since no
 * scheduler infrastructure exists yet.
 */
export async function runDeadlineReminders(): Promise<{ created: number; scanned: number }> {
  const windowEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const upcomingTasks = await TaskModel.find({
    deadline: { $ne: null, $lte: windowEnd, $gte: new Date() },
    status: { $ne: 'completed' },
  }).populate<{ assignedTo: { user?: unknown } | null }>('assignedTo', 'user');

  let created = 0;
  for (const task of upcomingTasks) {
    const assignedUserId = (task.assignedTo as { user?: unknown } | null)?.user;
    if (!assignedUserId) continue; // no linked login account to notify

    const alreadySent = await NotificationModel.exists({
      recipient: assignedUserId,
      type: 'deadline_reminder',
      'relatedEntity.id': task._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (alreadySent) continue;

    await notify({
      recipient: String(assignedUserId),
      type: 'deadline_reminder',
      title: 'Task deadline approaching',
      message: `"${task.title}" is due ${task.deadline!.toDateString()}.`,
      relatedEntity: { model: 'Task', id: String(task._id) },
    });
    created += 1;
  }

  return { created, scanned: upcomingTasks.length };
}
