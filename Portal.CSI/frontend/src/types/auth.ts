export type UserRole =
  | "SuperAdmin"
  | "AdminEvent"
  | "ITLead"
  | "DepartmentHead";

export interface AuthUser {
  userId: number;
  username: string;
  displayName: string;
  email?: string;
  role: UserRole;
  isActive?: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  message?: string;
}
