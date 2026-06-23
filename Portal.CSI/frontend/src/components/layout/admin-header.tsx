"use client";

import { logout } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./admin-shell.module.css";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

interface AdminHeaderProps {
  user: AuthUser;
  onMenuToggle?: () => void;
}

export default function AdminHeader({ user, onMenuToggle }: AdminHeaderProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.hamburger}
        onClick={onMenuToggle}
        aria-label="Toggle menu"
      >
        <span className={styles.hamburgerIcon}>
          <span />
          <span />
          <span />
        </span>
      </button>
      <Link className={styles.logoLink} href="/admin/dashboard" prefetch={false}>
        <Image className={styles.logo} src="/assets/img/logo.png" alt="Logo" width={28} height={28} priority />
        <span>AOP Event Management</span>
      </Link>
      <div ref={userMenuRef} className={styles.userWrap}>
        <button
          type="button"
          className={styles.userButton}
          onClick={() => setIsUserMenuOpen((prev) => !prev)}
        >
          <span>{user.displayName || initials(user.username)}</span>
        </button>
        {isUserMenuOpen ? (
          <div className={styles.userMenu}>
            <button
              type="button"
              className={styles.userMenuItem}
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
