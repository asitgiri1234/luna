import type { LucideIcon } from "lucide-react";

import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function SidebarNavItem({ to, label, icon: Icon }: SidebarNavItemProps) {
  return (
    <NavLink to={to} className="relative block">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-item"
              className="absolute inset-0 rounded-xl bg-sidebar-accent"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              isActive
                ? "font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
