import type { UserRole } from "@/types/auth";

export interface NavigationItem {
  label: string;
  href: string;
  group: "MAIN" | "EVENT" | "APPROVAL" | "MASTER" | "MAPPING" | "DOORPRIZE";
  icon:
    | "dashboard"
    | "eventManagement"
    | "report"
    | "approvalAdmin"
    | "bestComments"
    | "masterBu"
    | "masterDivisi"
    | "masterDepartment"
    | "masterFunction"
    | "masterAplikasi"
    | "mappingDeptAplikasi"
    | "mappingFunctionAplikasi"
    | "masterUser"
    | "auditTrail"
    | "emailBlast"
    | "doorprize";
  roles: UserRole[];
}

export const adminNavigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    group: "MAIN",
    icon: "dashboard",
    roles: ["SuperAdmin", "AdminEvent", "ITLead", "DepartmentHead"],
  },
  {
    label: "Event Management",
    href: "/admin/event-management",
    group: "EVENT",
    icon: "eventManagement",
    roles: ["SuperAdmin", "AdminEvent"],
  },
  {
    label: "Report",
    href: "/admin/report",
    group: "EVENT",
    icon: "report",
    roles: ["AdminEvent", "ITLead", "DepartmentHead"],
  },
  {
    label: "Email Blast",
    href: "/admin/email-blast",
    group: "EVENT",
    icon: "emailBlast",
    roles: ["SuperAdmin"],
  },
  {
    label: "Audit Trail",
    href: "/admin/audit-trail",
    group: "EVENT",
    icon: "auditTrail",
    roles: ["SuperAdmin"],
  },
  {
    label: "Approval Admin",
    href: "/admin/approval-admin",
    group: "APPROVAL",
    icon: "approvalAdmin",
    roles: ["AdminEvent"],
  },
  {
    label: "Approval IT Lead",
    href: "/admin/approval-it-lead",
    group: "APPROVAL",
    icon: "approvalAdmin",
    roles: ["ITLead"],
  },
  {
    label: "Best Comments",
    href: "/admin/best-comments",
    group: "APPROVAL",
    icon: "bestComments",
    roles: ["AdminEvent", "DepartmentHead"],
  },
  {
    label: "Master BU",
    href: "/admin/master-bu",
    group: "MASTER",
    icon: "masterBu",
    roles: ["AdminEvent"],
  },
  {
    label: "Master Divisi",
    href: "/admin/master-divisi",
    group: "MASTER",
    icon: "masterDivisi",
    roles: ["AdminEvent"],
  },
  {
    label: "Master Department",
    href: "/admin/master-department",
    group: "MASTER",
    icon: "masterDepartment",
    roles: ["AdminEvent"],
  },
  {
    label: "Master Function",
    href: "/admin/master-function",
    group: "MASTER",
    icon: "masterFunction",
    roles: ["AdminEvent"],
  },
  {
    label: "Master Aplikasi",
    href: "/admin/master-aplikasi",
    group: "MASTER",
    icon: "masterAplikasi",
    roles: ["AdminEvent"],
  },
  {
    label: "Dept -> Aplikasi",
    href: "/admin/dept-aplikasi",
    group: "MAPPING",
    icon: "mappingDeptAplikasi",
    roles: ["AdminEvent"],
  },
  {
    label: "Function -> Aplikasi",
    href: "/admin/function-aplikasi",
    group: "MAPPING",
    icon: "mappingFunctionAplikasi",
    roles: ["AdminEvent"],
  },
  {
    label: "Master User",
    href: "/admin/master-user",
    group: "MASTER",
    icon: "masterUser",
    roles: ["SuperAdmin"],
  },
];
