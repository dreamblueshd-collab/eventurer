"use client";

import AdminHeader from "@/components/layout/admin-header";
import AdminSidebar from "@/components/layout/admin-sidebar";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { adminNavigation } from "@/config/navigation";
import {
  captureCurrentLocation,
  redirectToLogin,
  validateSession,
} from "@/lib/auth";
import { buildTitleFromPath } from "@/lib/route-title";
import type { AuthUser } from "@/types/auth";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./admin-shell.module.css";

interface AdminShellProps {
  children: ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarState, setSidebarState] = useState<{ open: boolean; route: string }>({
    open: false,
    route: "",
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const sessionUser = await validateSession();
      if (!mounted) return;

      if (!sessionUser) {
        // Preserve the FULL current URL (path + search + hash) so that
        // after re-login the user is dropped back on the exact same page
        // — not stripped of their query string (e.g. surveyId, eventId,
        // id, filter, etc.). This used to break sub-event forms because
        // the next param only captured the pathname.
        const current = captureCurrentLocation();
        redirectToLogin({ reason: "session-expired" });
        // Touch `current` to avoid an unused-var lint while keeping the
        // explicit capture in scope for future debugging.
        void current;
        return;
      }

      setUser(sessionUser);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
    // We intentionally do NOT depend on `pathname` / `router` here. The
    // session check must run exactly once per mount; running it on every
    // route change would cause re-validation loops and is unnecessary
    // because the API layer (lib/*) handles 401s uniformly via
    // redirectToLogin().
  }, []);

  useEffect(() => {
    if (!pathname) return;
    document.title = buildTitleFromPath(pathname);
  }, [pathname]);

  const currentRoute = pathname || "";
  const isDrawPage = /\/admin\/doorprize\/[^/]+\/draw/.test(currentRoute);
  const hideSidebar = pathname?.startsWith("/admin/event-management/survey-create") || isDrawPage;
  const sidebarOpen = !hideSidebar && sidebarState.open && sidebarState.route === currentRoute;

  const closeSidebar = () => {
    setSidebarState((prev) => (prev.open ? { ...prev, open: false } : prev));
  };

  const toggleSidebar = () => {
    setSidebarState((prev) => {
      if (prev.open && prev.route === currentRoute) return { ...prev, open: false };
      return { open: true, route: currentRoute };
    });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Memuat sesi...
      </div>
    );
  }

  const menu = adminNavigation.filter((item) => item.roles.includes(user.role));

  // Draw page is fullscreen — render without admin chrome
  if (isDrawPage) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  return (
    <div className={styles.root}>
      <AdminHeader user={user} onMenuToggle={toggleSidebar} />

      <div className={styles.container}>
        {!hideSidebar && sidebarOpen ? (
          <div
            className={`${styles.sidebarOverlay} ${styles.sidebarOverlayVisible}`}
            onClick={closeSidebar}
          />
        ) : null}
        {!hideSidebar ? (
          <AdminSidebar
            menu={menu}
            pathname={pathname || ""}
            isOpen={sidebarOpen}
            onClose={closeSidebar}
          />
        ) : null}
        <main className={styles.content}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
