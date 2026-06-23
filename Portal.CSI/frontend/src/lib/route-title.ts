const APP_NAME = "CSI Portal";

function withApp(title: string): string {
  return `${title} | ${APP_NAME}`;
}

export function buildTitleFromPath(pathname: string): string {
  const path = pathname || "/";

  if (path === "/" || path === "/login" || path === "/admin/login") return withApp("Login");
  if (path === "/reset-password") return withApp("Reset Password");
  if (path === "/survey") return withApp("Survey");
  if (path.startsWith("/survey/resolve")) return withApp("Resolve Survey");
  if (path.startsWith("/survey/")) return withApp("Public Survey");

  if (path === "/admin/dashboard") return withApp("Dashboard");
  if (path === "/admin/event-management") return withApp("Event Management");
  if (/^\/admin\/event-management\/[^/]+\/operations$/.test(path)) return withApp("Operational Controls");
  if (path.startsWith("/admin/event-management/survey-create")) return withApp("Survey Builder");
  if (path === "/admin/email-blast") return withApp("Email Blast");
  if (path === "/admin/report") return withApp("Report");
  if (/^\/admin\/report\/[^/]+$/.test(path)) return withApp("Report Detail");
  if (path === "/admin/approval-admin") return withApp("Approval Admin");
  if (path === "/admin/approval-it-lead") return withApp("Approval IT Lead");
  if (path === "/admin/best-comments") return withApp("Best Comments");
  if (path === "/admin/audit-trail") return withApp("Audit Trail");
  if (path === "/admin/master-user") return withApp("Master User");
  if (path === "/admin/master-bu") return withApp("Master BU");
  if (path === "/admin/master-divisi") return withApp("Master Division");
  if (path === "/admin/master-department") return withApp("Master Department");
  if (path === "/admin/master-function") return withApp("Master Function");
  if (path === "/admin/master-aplikasi") return withApp("Master Application");
  if (path === "/admin/dept-aplikasi") return withApp("Mapping Department-Application");
  if (path === "/admin/function-aplikasi") return withApp("Mapping Function-Application");

  if (path.startsWith("/admin")) return withApp("Admin");
  return APP_NAME;
}

