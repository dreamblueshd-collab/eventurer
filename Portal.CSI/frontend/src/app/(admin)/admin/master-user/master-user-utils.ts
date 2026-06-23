import type { UserListItem } from "@/types/user";

export function roleLabel(role: string): string {
  switch (role) {
    case "SuperAdmin":
      return "Super Admin";
    case "AdminEvent":
      return "Admin Event";
    case "ITLead":
      return "IT Lead";
    case "DepartmentHead":
      return "Dept Head";
    default:
      return role;
  }
}

export function matchesUserSearch(user: UserListItem, searchBy: string, keyword: string): boolean {
  const term = keyword.trim().toLowerCase();
  if (!term) return true;

  if (searchBy === "npk") return (user.NPK || "").toLowerCase().includes(term);
  if (searchBy === "username") return user.Username.toLowerCase().includes(term);
  if (searchBy === "name") return user.DisplayName.toLowerCase().includes(term);
  if (searchBy === "email") return user.Email.toLowerCase().includes(term);
  if (searchBy === "role") return roleLabel(user.Role).toLowerCase().includes(term);

  return (
    (user.NPK || "").toLowerCase().includes(term) ||
    user.Username.toLowerCase().includes(term) ||
    user.DisplayName.toLowerCase().includes(term) ||
    user.Email.toLowerCase().includes(term) ||
    roleLabel(user.Role).toLowerCase().includes(term)
  );
}
