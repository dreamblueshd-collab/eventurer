export interface UserListItem {
  UserId: number;
  Username: string;
  NPK?: string | null;
  DisplayName: string;
  Email: string;
  PhoneNumber?: string | null;
  Role: "SuperAdmin" | "AdminEvent" | "ITLead" | "DepartmentHead" | string;
  UseLDAP: boolean;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string | null;
}

export interface UsersResponse {
  success: boolean;
  users: UserListItem[];
  message?: string;
  error?: string;
}
