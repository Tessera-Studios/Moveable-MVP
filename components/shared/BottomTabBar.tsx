"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

interface BottomTabBarProps {
  role: UserRole;
}

interface Tab {
  label: string;
  path: string;
  icon: React.JSX.Element;
}

function IconHome(): React.JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconUsers(): React.JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconClipboard(): React.JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function IconActivity(): React.JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconTrendingUp(): React.JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconMessageCircle(): React.JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const PROVIDER_TABS: Tab[] = [
  { label: "Home", path: "/provider", icon: <IconHome /> },
  { label: "Patients", path: "/provider/patients", icon: <IconUsers /> },
  { label: "Templates", path: "/provider/templates", icon: <IconClipboard /> },
  { label: "Messages", path: "/provider/messages", icon: <IconMessageCircle /> },
];

const PATIENT_TABS: Tab[] = [
  { label: "Home", path: "/patient", icon: <IconHome /> },
  { label: "Exercises", path: "/patient/profile", icon: <IconActivity /> },
  { label: "Progress", path: "/patient/progress", icon: <IconTrendingUp /> },
  { label: "Messages", path: "/patient/messages", icon: <IconMessageCircle /> },
];

export default function BottomTabBar({ role }: BottomTabBarProps): React.JSX.Element {
  const pathname = usePathname();
  const tabs = role === "provider" ? PROVIDER_TABS : PATIENT_TABS;

  function isActive(tab: Tab): boolean {
    if (tab.path === "/provider" || tab.path === "/patient") {
      return pathname === tab.path;
    }
    return pathname === tab.path || pathname.startsWith(tab.path + "/");
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-[env(safe-area-inset-bottom)] z-40">
      <div className="max-w-[512px] mx-auto flex items-stretch">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 transition-colors ${
                active ? "text-primary" : "text-placeholder"
              }`}
            >
              <span className="min-w-[44px] min-h-[44px] flex items-center justify-center">
                {tab.icon}
              </span>
              <span className="text-[10px] font-medium leading-none">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
