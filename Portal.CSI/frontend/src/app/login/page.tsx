import LoginForm from "@/components/auth/login-form";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

function normalizeNextTarget(next?: string): string {
  if (!next || typeof next !== "string") return "/admin/dashboard";
  if (!next.startsWith("/")) return "/admin/dashboard";

  // Split path from query/hash so we can validate the *path* portion
  // against the allow-list while preserving the full original URL
  // (including search params) on output. This is critical for pages
  // like /admin/event-management/survey-create?surveyId=1&eventId=2
  // — the user must be returned with their query string intact.
  const [rawPath] = next.split(/[?#]/);
  const pathOnly = rawPath || "";
  const tail = next.slice(pathOnly.length); // includes "?" / "#" and what follows

  const path = pathOnly.replace("/admin/event_management", "/admin/event-management");

  const allowedPrefixes = [
    "/admin/dashboard",
    "/admin/event-management",
    "/admin/master-user",
    "/admin/report",
    "/admin/approval-admin",
    "/admin/approval-it-lead",
    "/admin/best-comments",
    "/admin/master-bu",
    "/admin/master-divisi",
    "/admin/master-department",
    "/admin/master-function",
    "/admin/master-aplikasi",
    "/admin/dept-aplikasi",
    "/admin/function-aplikasi",
  ];

  const allowed = allowedPrefixes.some((prefix) => path.startsWith(prefix));
  if (!allowed) return "/admin/dashboard";

  return `${path}${tail || ""}`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextTarget = normalizeNextTarget(params.next);
  return <LoginForm nextTarget={nextTarget} />;
}
