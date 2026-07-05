import { FilterQuery } from 'mongoose';
import { TaskModel, type Task, type TaskDocument } from '../models/task.model.js';
import { ProjectModel } from '../models/project.model.js';
import { EmployeeModel } from '../models/employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { TaskStatus, Priority } from '../constants/enums.js';
import { notifyTaskAssigned } from './notification.service.js';

interface ListTasksInput {
  page?: number;
  limit?: number;
  project?: string;
  assignedTo?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignedToMe?: boolean;
  search?: string;
}

const POPULATE_FIELDS = [
  { path: 'project', select: 'name status' },
  { path: 'assignedTo', select: 'name department designation' },
  { path: 'assignedBy', select: 'name email role' },
];

async function assertProjectExists(projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const exists = await ProjectModel.exists({ _id: projectId });
  if (!exists) throw ApiError.badRequest('project does not reference an existing project');
}

async function assertEmployeeExists(employeeId: string | undefined): Promise<void> {
  if (!employeeId) return;
  const exists = await EmployeeModel.exists({ _id: employeeId });
  if (!exists) throw ApiError.badRequest('assignedTo does not reference an existing employee');
}

/** Notifies the employee's linked login account, if any, that they were assigned this task. */
async function notifyAssignment(task: TaskDocument, employeeId: string): Promise<void> {
  const employee = await EmployeeModel.findById(employeeId).select('user');
  if (employee?.user) {
    await notifyTaskAssigned(task, employee.user.toString());
  }
}

export async function listTasks(
  input: ListTasksInput,
  currentUserId: string,
): Promise<{ tasks: TaskDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<Task> = {};
  if (input.project) filter.project = input.project;
  if (input.status) filter.status = input.status;
  if (input.priority) filter.priority = input.priority;

  if (input.assignedToMe) {
    const employee = await EmployeeModel.findOne({ user: currentUserId }).select('_id');
    // No linked employee record => this user can't be assigned any tasks.
    filter.assignedTo = employee?._id ?? null;
  } else if (input.assignedTo) {
    filter.assignedTo = input.assignedTo;
  }

  if (input.search) {
    filter.title = new RegExp(input.search.trim(), 'i');
  }

  const [tasks, total] = await Promise.all([
    TaskModel.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    TaskModel.countDocuments(filter),
  ]);

  return { tasks, meta: buildPaginationMeta(pagination, total) };
}

export async function getTaskById(id: string): Promise<TaskDocument> {
  const task = await TaskModel.findById(id).populate(POPULATE_FIELDS);
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

export async function createTask(
  input: Partial<Task>,
  assignedBy: string,
): Promise<TaskDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertEmployeeExists(input.assignedTo?.toString()),
  ]);

  const task = await TaskModel.create({ ...input, assignedBy });
  if (task.assignedTo) await notifyAssignment(task, task.assignedTo.toString());

  return task.populate(POPULATE_FIELDS);
}

export async function updateTask(id: string, input: Partial<Task>): Promise<TaskDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertEmployeeExists(input.assignedTo?.toString()),
  ]);

  const task = await TaskModel.findById(id);
  if (!task) throw ApiError.notFound('Task not found');

  const previousAssignee = task.assignedTo?.toString();
  Object.assign(task, input);
  await task.save(); // re-runs the completed-status/progress hook

  const newAssignee = task.assignedTo?.toString();
  if (newAssignee && newAssignee !== previousAssignee) {
    await notifyAssignment(task, newAssignee);
  }

  return task.populate(POPULATE_FIELDS);
}

export async function deleteTask(id: string): Promise<void> {
  const task = await TaskModel.findByIdAndDelete(id);
  if (!task) throw ApiError.notFound('Task not found');
}

/**
 * Lets the assigned employee (via their linked User account) update their own
 * task's status/progress without the broader manager permissions required by
 * `updateTask`. Managers (super_admin/project_manager) may always use this too.
 */
export async function updateTaskProgress(
  id: string,
  input: { status?: TaskStatus; progress?: number },
  currentUser: { id: string; role: string },
): Promise<TaskDocument> {
  const task = await TaskModel.findById(id);
  if (!task) throw ApiError.notFound('Task not found');

  const isManager = currentUser.role === 'super_admin' || currentUser.role === 'project_manager';
  if (!isManager) {
    const employee = await EmployeeModel.findOne({ user: currentUser.id }).select('_id');
    const owns = employee && task.assignedTo && employee._id.equals(task.assignedTo);
    if (!owns) {
      throw ApiError.forbidden('You can only update progress on tasks assigned to you');
    }
  }

  if (input.status !== undefined) task.status = input.status;
  if (input.progress !== undefined) task.progress = input.progress;
  await task.save();

  return task.populate(POPULATE_FIELDS);
}
