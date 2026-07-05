import { FilterQuery } from 'mongoose';
import { ProjectModel, type Project, type ProjectDocument } from '../models/project.model.js';
import { UserModel } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { ProjectStatus } from '../constants/enums.js';

interface ListProjectsInput {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  search?: string;
}

/** Confirms a `manager` reference (if provided) points to a real user. */
async function assertManagerExists(managerId: string | undefined): Promise<void> {
  if (!managerId) return;
  const exists = await UserModel.exists({ _id: managerId });
  if (!exists) throw ApiError.badRequest('manager does not reference an existing user');
}

export async function listProjects(
  input: ListProjectsInput,
): Promise<{ projects: ProjectDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<Project> = {};
  if (input.status) filter.status = input.status;
  if (input.search) {
    const regex = new RegExp(input.search.trim(), 'i');
    filter.$or = [{ name: regex }, { client: regex }, { location: regex }];
  }

  const [projects, total] = await Promise.all([
    ProjectModel.find(filter)
      .populate('manager', 'name email role')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    ProjectModel.countDocuments(filter),
  ]);

  return { projects, meta: buildPaginationMeta(pagination, total) };
}

export async function getProjectById(id: string): Promise<ProjectDocument> {
  const project = await ProjectModel.findById(id).populate('manager', 'name email role');
  if (!project) throw ApiError.notFound('Project not found');
  return project;
}

export async function createProject(input: Partial<Project>): Promise<ProjectDocument> {
  await assertManagerExists(input.manager?.toString());
  const project = await ProjectModel.create(input);
  return project.populate('manager', 'name email role');
}

export async function updateProject(
  id: string,
  input: Partial<Project>,
): Promise<ProjectDocument> {
  await assertManagerExists(input.manager?.toString());

  const project = await ProjectModel.findById(id);
  if (!project) throw ApiError.notFound('Project not found');

  Object.assign(project, input);
  await project.save(); // re-runs schema validators/hooks (e.g. endDate >= startDate)

  return project.populate('manager', 'name email role');
}

export async function deleteProject(id: string): Promise<void> {
  const project = await ProjectModel.findByIdAndDelete(id);
  if (!project) throw ApiError.notFound('Project not found');
}
