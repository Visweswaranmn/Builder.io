export type UserRole = 'super_admin' | 'project_manager' | 'site_engineer' | 'accountant';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
}
