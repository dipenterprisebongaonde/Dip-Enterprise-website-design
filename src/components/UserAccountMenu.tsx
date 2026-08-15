"use client";

import Link from "next/link";
import { LogOut, UserPen, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UserAccountMenu({
  userName,
  role,
}: {
  userName: string;
  role: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="app-avatar account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title={userName}
        onClick={() => setOpen((value) => !value)}
      >
        {initials || "DE"}
      </button>
      {open ? (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-head">
            <strong>{userName}</strong>
            <span>{role === "SUPER_ADMIN" ? "Super Admin" : "Staff"}</span>
          </div>
          <Link
            href="/dashboard/profile"
            role="menuitem"
            className="account-menu-item"
            onClick={() => setOpen(false)}
          >
            <UserPen size={16} aria-hidden />
            Edit profile
          </Link>
          {role === "SUPER_ADMIN" ? (
            <Link
              href="/dashboard/users"
              role="menuitem"
              className="account-menu-item"
              onClick={() => setOpen(false)}
            >
              <Users size={16} aria-hidden />
              Manage users
            </Link>
          ) : null}
          <button type="button" role="menuitem" className="account-menu-item danger" onClick={logout}>
            <LogOut size={16} aria-hidden />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
