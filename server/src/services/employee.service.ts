import { FilterQuery } from 'mongoose';
import { EmployeeModel, type Employee, type EmployeeDocument } from '../models/employee.model.js';
import { ProjectModel } from '../models/project.model.js';
import { UserModel } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { Department, AttendanceStatus } from '../constants/enums.js';

interface ListEmployeesInput {
  page?: number;
  limit?: number;
  department?: Department;
  project?: string;
  isActive?: boolean;
  search?: string;
}

const POPULATE_FIELDS = [
  { path: 'project', select: 'name status' },
  { path: 'manager', select: 'name email role' },
  { path: 'user', select: 'name email role' },
];

async function assertProjectExists(projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const exists = await ProjectModel.exists({ _id: projectId });
  if (!exists) throw ApiError.badRequest('project does not reference an existing project');
}

async function assertManagerExists(managerId: string | undefined): Promise<void> {
  if (!managerId) return;
  const exists = await UserModel.exists({ _id: managerId });
  if (!exists) throw ApiError.badRequest('manager does not reference an existing user');
}

async function assertUserLinkable(
  userId: string | undefined,
  excludeEmployeeId?: string,
): Promise<void> {
  if (!userId) return;
  const userExists = await UserModel.exists({ _id: userId });
  if (!userExists) throw ApiError.badRequest('user does not reference an existing account');

  const alreadyLinked = await EmployeeModel.exists({
    user: userId,
    ...(excludeEmployeeId ? { _id: { $ne: excludeEmployeeId } } : {}),
  });
  if (alreadyLinked) throw ApiError.conflict('This user account is already linked to another employee');
}

export async function listEmployees(
  input: ListEmployeesInput,
): Promise<{ employees: EmployeeDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<Employee> = {};
  if (input.department) filter.department = input.department;
  if (input.project) filter.project = input.project;
  if (input.isActive !== undefined) filter.isActive = input.isActive;
  if (input.search) {
    const regex = new RegExp(input.search.trim(), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { designation: regex }];
  }

  const [employees, total] = await Promise.all([
    EmployeeModel.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    EmployeeModel.countDocuments(filter),
  ]);

  return { employees, meta: buildPaginationMeta(pagination, total) };
}

export async function getEmployeeById(id: string): Promise<EmployeeDocument> {
  const employee = await EmployeeModel.findById(id).populate(POPULATE_FIELDS);
  if (!employee) throw ApiError.notFound('Employee not found');
  return employee;
}

export async function createEmployee(input: Partial<Employee>): Promise<EmployeeDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertManagerExists(input.manager?.toString()),
    assertUserLinkable(input.user?.toString()),
  ]);

  const employee = await EmployeeModel.create(input);
  return employee.populate(POPULATE_FIELDS);
}

export async function updateEmployee(
  id: string,
  input: Partial<Employee>,
): Promise<EmployeeDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertManagerExists(input.manager?.toString()),
    assertUserLinkable(input.user?.toString(), id),
  ]);

  const employee = await EmployeeModel.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found');

  Object.assign(employee, input);
  await employee.save();

  return employee.populate(POPULATE_FIELDS);
}

export async function deleteEmployee(id: string): Promise<void> {
  const employee = await EmployeeModel.findByIdAndDelete(id);
  if (!employee) throw ApiError.notFound('Employee not found');
}

/**
 * Records (or corrects) a single day's attendance. Upserts by calendar day so
 * re-submitting the same date updates the existing entry instead of creating
 * a duplicate.
 */
export async function markAttendance(
  employeeId: string,
  entry: { date: Date; status: AttendanceStatus; checkIn?: Date; checkOut?: Date; note?: string },
): Promise<EmployeeDocument> {
  const employee = await EmployeeModel.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const dayStart = new Date(entry.date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const existingIndex = employee.attendance.findIndex(
    (a) => a.date >= dayStart && a.date < dayEnd,
  );

  if (existingIndex >= 0) {
    employee.attendance[existingIndex].status = entry.status;
    employee.attendance[existingIndex].checkIn = entry.checkIn;
    employee.attendance[existingIndex].checkOut = entry.checkOut;
    employee.attendance[existingIndex].note = entry.note;
  } else {
    employee.attendance.push(entry);
  }

  await employee.save();
  return employee;
}

export type AttendanceEntry = Employee['attendance'][number];

export async function getAttendance(
  employeeId: string,
  range: { from?: Date; to?: Date },
): Promise<AttendanceEntry[]> {
  const employee = await EmployeeModel.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  return employee.attendance
    .filter((a) => (!range.from || a.date >= range.from) && (!range.to || a.date <= range.to))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
