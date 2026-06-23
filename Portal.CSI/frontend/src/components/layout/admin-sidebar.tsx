import type { NavigationItem } from "@/config/navigation";
import Link from "next/link";
import styles from "./admin-shell.module.css";

interface BreadcrumbEntry {
  label: string;
  href: string;
}

function getSidebarBreadcrumb(pathname: string): BreadcrumbEntry | null {
  const eventDetailMatch = pathname.match(/^\/admin\/event-management\/(?!survey-create)([^/]+)(?:\/.*)?$/);
  if (eventDetailMatch) {
    return { label: "Event Management", href: "/admin/event-management" };
  }
  return null;
}

function menuIconClass(icon: NavigationItem["icon"]): string {
  switch (icon) {
    case "dashboard":
      return styles.menuDashboard;
    case "eventManagement":
      return styles.menuEvent;
    case "report":
      return styles.menuReport;
    case "approvalAdmin":
      return styles.menuApproval;
    case "bestComments":
      return styles.menuBestComments;
    case "masterBu":
      return styles.menuMasterBu;
    case "masterDivisi":
      return styles.menuMasterDivisi;
    case "masterDepartment":
      return styles.menuMasterDepartment;
    case "masterFunction":
      return styles.menuMasterFunction;
    case "masterAplikasi":
      return styles.menuMasterAplikasi;
    case "mappingDeptAplikasi":
      return styles.menuMappingDept;
    case "mappingFunctionAplikasi":
      return styles.menuMappingFunction;
    case "masterUser":
      return styles.menuMasterUser;
    case "auditTrail":
      return styles.menuAuditTrail;
    case "emailBlast":
      return styles.menuEvent;
    case "doorprize":
      return styles.menuDoorprize;
    default:
      return styles.menuDashboard;
  }
}

const groupLabels: Record<string, string> = {
  MAIN: "Menu Utama",
  EVENT: "Event & Monitoring",
  APPROVAL: "Approval",
  MASTER: "Master Data",
  MAPPING: "Mapping",
  DOORPRIZE: "Doorprize",
};

const menuOrder = ["MAIN", "EVENT", "APPROVAL", "MASTER", "MAPPING", "DOORPRIZE"] as const;

type GroupedMenu = Partial<Record<(typeof menuOrder)[number], NavigationItem[]>>;

interface AdminSidebarProps {
  menu: NavigationItem[];
  pathname: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ menu, pathname, isOpen, onClose }: AdminSidebarProps) {
  const groupedMenu = menu.reduce<GroupedMenu>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group]?.push(item);
    return acc;
  }, {});

  const breadcrumb = getSidebarBreadcrumb(pathname);

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
      {breadcrumb && (
        <div className={styles.sidebarBreadcrumb}>
          <Link href={breadcrumb.href} className={styles.sidebarBreadcrumbLink} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {breadcrumb.label}
          </Link>
        </div>
      )}
      <ul className={styles.menu}>
        {menuOrder.map((groupName) => {
          const items = groupedMenu[groupName] || [];
          if (items.length === 0) return null;

          return (
            <li key={groupName}>
              <div className={styles.menuTitle}>{groupLabels[groupName] ?? groupName}</div>
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={onClose}
                    className={[
                      styles.menuLink,
                      menuIconClass(item.icon),
                      active ? styles.menuLinkActive : "",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
