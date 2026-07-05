import { FilterQuery } from 'mongoose';
import { UserModel, type User, type UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { UserRole } from '../constants/enums.js';

interface ListUsersInput {
  page?: number;
  limit?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export async function listUsers(
  input: ListUsersInput,
): Promise<{ users: UserDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<User> = {};
  if (input.role) filter.role = input.role;
  if (input.isActive !== undefined) filter.isActive = input.isActive;
  if (input.search) {
    const regex = new RegExp(input.search.trim(), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [users, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    UserModel.countDocuments(filter),
  ]);

  return { users, meta: buildPaginationMeta(pagination, total) };
}

export async function getUserById(id: string): Promise<UserDocument> {
  const user = await UserModel.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
}): Promise<UserDocument> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }
  return UserModel.create(input);
}

export async function updateUser(
  id: string,
  input: { name?: string; phone?: string; role?: UserRole; isActive?: boolean },
): Promise<UserDocument> {
  const user = await UserModel.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  Object.assign(user, input);
  await user.save();
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const user = await UserModel.findByIdAndDelete(id);
  if (!user) throw ApiError.notFound('User not found');
}
